import { ROLE_KEYS } from "./constants.js";
import { clamp, tuneColor } from "./color.js";

export function createMeshScene(roles, presetId, overrides = {}) {
  const density = clamp(Math.round(overrides.meshDensity || 4), 3, 6);
  const seed = hashRoles(roles, presetId);

  return {
    id: `${seed}-${presetId}`,
    presetId,
    roles,
    settings: {
      ...overrides,
      meshDensity: density
    },
    keyframes: {
      a: createMeshKeyframe(seed, density, roles, presetId, 0),
      b: createMeshKeyframe(seed + 137, density, roles, presetId, 0.11)
    }
  };
}

export function hydrateScene(serialized) {
  return serialized;
}

export function serializeScene(scene) {
  return scene;
}

function createMeshKeyframe(seed, density, roles, presetId, shift) {
  const random = mulberry32(seed);
  const points = [];
  const roleSequence = roleOrderForPreset(presetId);
  const size = density - 1;

  for (let row = 0; row < density; row += 1) {
    for (let column = 0; column < density; column += 1) {
      const nx = size === 0 ? 0 : column / size;
      const ny = size === 0 ? 0 : row / size;
      const edgeWeight = Math.max(Math.abs(nx - 0.5) * 2, Math.abs(ny - 0.5) * 2);
      const isEdge = edgeWeight > 0.9;
      const roleIndex = (row * density + column + Math.round(shift * 10)) % roleSequence.length;
      const role = isEdge ? "baseDark" : roleSequence[roleIndex];
      const wobbleX = (random() - 0.5) * 0.18 + shift;
      const wobbleY = (random() - 0.5) * 0.18 - shift * 0.7;
      const brightnessBoost = isEdge ? 0.72 : 0.92 + random() * 0.18;

      points.push({
        position: {
          x: clamp(nx + wobbleX * 0.18, 0, 1),
          y: clamp(ny + wobbleY * 0.18, 0, 1)
        },
        drift: {
          x: 0.4 + random() * 0.7,
          y: 0.4 + random() * 0.7,
          phase: random() * Math.PI * 2
        },
        color: tuneColor(roles[role], brightnessBoost, isEdge ? 0.72 : 1.02)
      });
    }
  }

  return {
    density,
    points
  };
}

function roleOrderForPreset(presetId) {
  if (presetId === "bloom") {
    return ["highlight", "primary", "accent", "secondary", "support"];
  }
  if (presetId === "deep") {
    return ["secondary", "primary", "support", "accent", "highlight"];
  }
  if (presetId === "iridescent") {
    return ["accent", "highlight", "primary", "support", "secondary"];
  }
  return ["primary", "secondary", "highlight", "accent", "support"];
}

function hashRoles(roles, presetId) {
  const text = ROLE_KEYS.map((key) => {
    const color = roles[key];
    return `${key}:${Math.round(color.r)}-${Math.round(color.g)}-${Math.round(color.b)}`;
  }).join("|") + presetId;

  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) + 1;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let result = Math.imul(t ^ (t >>> 15), 1 | t);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}
