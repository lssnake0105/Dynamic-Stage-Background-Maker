export const PRESETS = {
  soft: {
    id: "soft",
    name: "Soft",
    description: "Velvety gradients with restrained motion.",
    settings: {
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
