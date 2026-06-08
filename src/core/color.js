export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function mix(a, b, amount) {
  return a + (b - a) * amount;
}

export function mixColor(a, b, amount) {
  return {
    r: mix(a.r, b.r, amount),
    g: mix(a.g, b.g, amount),
    b: mix(a.b, b.b, amount)
  };
}

export function rgba(color, alpha = 1) {
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${alpha})`;
}

export function rgbToLuminance({ r, g, b }) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function rgbToHsv({ r, g, b }) {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === nr) {
      h = ((ng - nb) / delta) % 6;
    } else if (max === ng) {
      h = (nb - nr) / delta + 2;
    } else {
      h = (nr - ng) / delta + 4;
    }
  }

  return {
    h: (h * 60 + 360) % 360,
    s: max === 0 ? 0 : delta / max,
    v: max
  };
}

export function hsvToRgb({ h, s, v }) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

export function tuneColor(color, brightness = 1, saturationBoost = 1) {
  const gray = rgbToLuminance(color) * 255;
  return {
    r: clamp((gray + (color.r - gray) * saturationBoost) * brightness, 0, 255),
    g: clamp((gray + (color.g - gray) * saturationBoost) * brightness, 0, 255),
    b: clamp((gray + (color.b - gray) * saturationBoost) * brightness, 0, 255)
  };
}

export function rgbToLab(rgb) {
  const xyz = rgbToXyz(rgb);
  const refX = 95.047;
  const refY = 100;
  const refZ = 108.883;
  const x = pivotLab(xyz.x / refX);
  const y = pivotLab(xyz.y / refY);
  const z = pivotLab(xyz.z / refZ);

  return {
    l: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z)
  };
}

export function labToRgb(lab) {
  const refX = 95.047;
  const refY = 100;
  const refZ = 108.883;
  const y = (lab.l + 16) / 116;
  const x = lab.a / 500 + y;
  const z = y - lab.b / 200;

  return xyzToRgb({
    x: refX * inversePivotLab(x),
    y: refY * inversePivotLab(y),
    z: refZ * inversePivotLab(z)
  });
}

function rgbToXyz({ r, g, b }) {
  const srgb = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel > 0.04045
      ? Math.pow((channel + 0.055) / 1.055, 2.4)
      : channel / 12.92;
  });

  return {
    x: (srgb[0] * 0.4124 + srgb[1] * 0.3576 + srgb[2] * 0.1805) * 100,
    y: (srgb[0] * 0.2126 + srgb[1] * 0.7152 + srgb[2] * 0.0722) * 100,
    z: (srgb[0] * 0.0193 + srgb[1] * 0.1192 + srgb[2] * 0.9505) * 100
  };
}

function xyzToRgb({ x, y, z }) {
  const nx = x / 100;
  const ny = y / 100;
  const nz = z / 100;
  const linear = {
    r: nx * 3.2406 + ny * -1.5372 + nz * -0.4986,
    g: nx * -0.9689 + ny * 1.8758 + nz * 0.0415,
    b: nx * 0.0557 + ny * -0.204 + nz * 1.057
  };

  return {
    r: clamp(Math.round(applyGamma(linear.r) * 255), 0, 255),
    g: clamp(Math.round(applyGamma(linear.g) * 255), 0, 255),
    b: clamp(Math.round(applyGamma(linear.b) * 255), 0, 255)
  };
}

function applyGamma(value) {
  const safe = Math.max(0, value);
  return safe > 0.0031308 ? 1.055 * Math.pow(safe, 1 / 2.4) - 0.055 : 12.92 * safe;
}

function pivotLab(value) {
  return value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
}

function inversePivotLab(value) {
  const cube = value ** 3;
  return cube > 0.008856 ? cube : (value - 16 / 116) / 7.787;
}
