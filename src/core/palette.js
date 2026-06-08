import {
  labToRgb,
  rgbToHsv,
  rgbToLab,
  rgbToLuminance,
  tuneColor
} from "./color.js";

const FALLBACK_COLORS = [
  { r: 170, g: 84, b: 78 },
  { r: 118, g: 146, b: 189 },
  { r: 203, g: 177, b: 111 },
  { r: 84, g: 98, b: 121 },
  { r: 234, g: 218, b: 194 },
  { r: 160, g: 139, b: 189 }
];

export function extractPaletteRoles(image) {
  const pixels = sampleImagePixels(image, 96);
  const filtered = pixels
    .map((pixel) => ({ ...pixel, hsv: rgbToHsv(pixel) }))
    .filter(({ hsv }) => {
      if (hsv.v < 0.06) {
        return false;
      }
      if (hsv.v > 0.96 && hsv.s < 0.12) {
        return false;
      }
      if (hsv.s < 0.08) {
        return false;
      }
      return true;
    });

  if (filtered.length < 64) {
    return buildRoleMap(FALLBACK_COLORS);
  }

  const clusters = kmeansPlusPlus(filtered, 6, 12);
  if (clusters.length < 5) {
    return buildRoleMap(FALLBACK_COLORS);
  }

  const enriched = clusters.map((cluster) => {
    const rgb = labToRgb(cluster.lab);
    const hsv = rgbToHsv(rgb);
    return {
      ...cluster,
      rgb,
      hsv,
      luminance: rgbToLuminance(rgb),
      score: cluster.count * (0.55 + hsv.s)
    };
  });

  const darkest = [...enriched].sort((a, b) => a.luminance - b.luminance)[0];
  const remaining = enriched.filter((item) => item !== darkest);
  const vivid = [...remaining].sort((a, b) => b.score - a.score);
  const primary = vivid[0];
  const secondary = vivid[1] || vivid[0];
  const leftovers = remaining.filter((item) => item !== primary && item !== secondary);
  const highlight = [...leftovers].sort((a, b) => b.hsv.v - a.hsv.v)[0] || secondary;
  const accent = leftovers.find((item) => item !== highlight) || vivid[2] || primary;
  const support = vivid[3] || accent;

  return {
    baseDark: tuneColor(darkest.rgb, 0.68, 0.82),
    primary: tuneColor(primary.rgb, 0.94, 0.92),
    secondary: tuneColor(secondary.rgb, 0.88, 0.9),
    accent: tuneColor(accent.rgb, 1.02, 0.98),
    highlight: tuneColor(highlight.rgb, 1.08, 0.88),
    support: tuneColor(support.rgb, 0.96, 0.88)
  };
}

export function serializeRoles(roles) {
  return Object.fromEntries(
    Object.entries(roles).map(([key, color]) => [
      key,
      {
        r: Math.round(color.r),
        g: Math.round(color.g),
        b: Math.round(color.b)
      }
    ])
  );
}

function buildRoleMap(colors) {
  return {
    baseDark: tuneColor(colors[3], 0.58, 0.8),
    primary: tuneColor(colors[1], 0.94, 0.92),
    secondary: tuneColor(colors[0], 0.88, 0.9),
    accent: tuneColor(colors[2], 1.02, 0.9),
    highlight: tuneColor(colors[4], 1.08, 0.84),
    support: tuneColor(colors[5] || colors[2], 0.94, 0.84)
  };
}

function sampleImagePixels(image, size) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(image, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const pixels = [];

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 180) {
      continue;
    }
    pixels.push({
      r: data[index],
      g: data[index + 1],
      b: data[index + 2]
    });
  }

  return pixels;
}

function kmeansPlusPlus(pixels, clusterCount, iterations) {
  const labs = pixels.map((pixel) => ({
    ...pixel,
    lab: rgbToLab(pixel)
  }));
  const random = createDeterministicRandom(pixels);
  const centroids = [labs[Math.floor(random() * labs.length)].lab];

  while (centroids.length < clusterCount) {
    const distances = labs.map(({ lab }) => {
      let nearest = Infinity;
      centroids.forEach((centroid) => {
        nearest = Math.min(nearest, labDistanceSquared(lab, centroid));
      });
      return nearest;
    });
    const total = distances.reduce((sum, value) => sum + value, 0);
    if (!total) {
      break;
    }
    const threshold = random() * total;
    let running = 0;
    for (let index = 0; index < labs.length; index += 1) {
      running += distances[index];
      if (running >= threshold) {
        centroids.push(labs[index].lab);
        break;
      }
    }
  }

  let currentCentroids = centroids.map((centroid) => ({ ...centroid }));

  for (let loop = 0; loop < iterations; loop += 1) {
    const buckets = currentCentroids.map(() => ({
      l: 0,
      a: 0,
      b: 0,
      count: 0
    }));
    labs.forEach((sample) => {
      let bestIndex = 0;
      let bestDistance = Infinity;
      currentCentroids.forEach((centroid, index) => {
        const distance = labDistanceSquared(sample.lab, centroid);
        if (distance < bestDistance) {
          bestIndex = index;
          bestDistance = distance;
        }
      });
      const bucket = buckets[bestIndex];
      bucket.l += sample.lab.l;
      bucket.a += sample.lab.a;
      bucket.b += sample.lab.b;
      bucket.count += 1;
    });

    currentCentroids = buckets.map((bucket, index) => {
      if (!bucket.count) {
        return currentCentroids[index];
      }
      return {
        l: bucket.l / bucket.count,
        a: bucket.a / bucket.count,
        b: bucket.b / bucket.count
      };
    });
  }

  const clusterMap = currentCentroids.map((centroid) => ({
    lab: centroid,
    count: 0
  }));

  labs.forEach((sample) => {
    let bestIndex = 0;
    let bestDistance = Infinity;
    currentCentroids.forEach((centroid, index) => {
      const distance = labDistanceSquared(sample.lab, centroid);
      if (distance < bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    });
    clusterMap[bestIndex].count += 1;
  });

  return clusterMap.filter((cluster) => cluster.count > 0);
}

function createDeterministicRandom(pixels) {
  let seed = 2166136261;
  const step = Math.max(1, Math.floor(pixels.length / 128));
  for (let index = 0; index < pixels.length; index += step) {
    const pixel = pixels[index];
    seed ^= pixel.r;
    seed = Math.imul(seed, 16777619);
    seed ^= pixel.g;
    seed = Math.imul(seed, 16777619);
    seed ^= pixel.b;
    seed = Math.imul(seed, 16777619);
  }

  let localState = seed >>> 0;
  return () => {
    localState += 0x6d2b79f5;
    let result = Math.imul(localState ^ (localState >>> 15), 1 | localState);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function labDistanceSquared(a, b) {
  const dl = a.l - b.l;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return dl * dl + da * da + db * db;
}
