export const PRESETS = {
  soft: {
    id: "soft",
    name: "Soft",
    description: "Velvety gradients with restrained motion.",
    settings: {
      effectMode: "aura",
      speed: 1,
      blur: 0.64,
      brightness: 0.98,
      motionStrength: 0.78,
      grain: 0.01,
      vignette: 0.44,
      haze: 0.2,
      colorSmoothness: 0.74,
      meshAmplitude: 0.028,
      meshDensity: 4,
      transitionDuration: 4,
      cycleDuration: 16
    }
  },
  bloom: {
    id: "bloom",
    name: "Bloom",
    description: "Luminous center glow with lifted highlights.",
    settings: {
      effectMode: "diffusion",
      speed: 0.92,
      blur: 0.72,
      brightness: 1.06,
      motionStrength: 0.92,
      grain: 0.014,
      vignette: 0.36,
      haze: 0.28,
      colorSmoothness: 0.82,
      meshAmplitude: 0.032,
      meshDensity: 4,
      transitionDuration: 4,
      cycleDuration: 16
    }
  },
  deep: {
    id: "deep",
    name: "Deep",
    description: "Darker edges and richer cinematic contrast.",
    settings: {
      effectMode: "nebula",
      speed: 0.82,
      blur: 0.7,
      brightness: 0.86,
      motionStrength: 0.7,
      grain: 0.018,
      vignette: 0.58,
      haze: 0.14,
      colorSmoothness: 0.68,
      meshAmplitude: 0.024,
      meshDensity: 4,
      transitionDuration: 4,
      cycleDuration: 16
    }
  },
  iridescent: {
    id: "iridescent",
    name: "Iridescent",
    description: "Higher chroma, shimmer, and refined movement.",
    settings: {
      effectMode: "liquid",
      speed: 1.12,
      blur: 0.58,
      brightness: 1.02,
      motionStrength: 1.08,
      grain: 0.016,
      vignette: 0.42,
      haze: 0.24,
      colorSmoothness: 0.88,
      meshAmplitude: 0.038,
      meshDensity: 4,
      transitionDuration: 4,
      cycleDuration: 16
    }
  }
};

export const EFFECT_MODES = [
  { id: "mesh", name: "Mesh Gradient", description: "Structured color mesh from the current palette." },
  { id: "aura", name: "Aura", description: "Soft orbital glows and slow light blooms." },
  { id: "silk", name: "Silk", description: "Layered ribbon bands with gentle wave motion." },
  { id: "liquid", name: "Liquid", description: "Fluid color fields and luminous contour rings." },
  { id: "nebula", name: "Nebula", description: "Deep radial rays and drifting cosmic haze." },
  { id: "turbulence", name: "Turbulence", description: "High-energy curled bands for stronger motion." },
  { id: "diffusion", name: "Diffusion", description: "Large blurred color clouds with calm transitions." },
  { id: "foliage", name: "Foliage", description: "Leaf-like elliptical layers and organic drift." },
  { id: "mist", name: "Mist", description: "Wide atmospheric clouds with desaturated movement." }
];

export const DEFAULT_PALETTE_ROLES = {
  baseDark: { r: 32, g: 24, b: 38 },
  primary: { r: 219, g: 75, b: 83 },
  secondary: { r: 65, g: 153, b: 178 },
  accent: { r: 242, g: 196, b: 82 },
  highlight: { r: 246, g: 232, b: 186 },
  support: { r: 45, g: 62, b: 136 }
};

export const ROLE_KEYS = [
  "baseDark",
  "primary",
  "secondary",
  "accent",
  "highlight",
  "support"
];

export const EXPORT_SIZES = [
  { label: "480p", value: "854x480" },
  { label: "720p", value: "1280x720" },
  { label: "1080p", value: "1920x1080" }
];

export const EXPORT_DURATIONS = [5, 10, 20, 30, 60];
export const DEFAULT_EXPORT_SIZE = "1280x720";
