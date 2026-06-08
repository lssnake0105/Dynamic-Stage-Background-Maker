import { mixColor, rgba, tuneColor } from "./color.js";
import { ROLE_KEYS } from "./constants.js";

export function rolesToPalette(roles) {
  return ROLE_KEYS.map((key) => roles[key]).filter(Boolean);
}

export function drawEffectScene(ctx, width, height, scene, motionState, controls) {
  const minSide = Math.min(width, height);
  const maxSide = Math.max(width, height);
  const palette = rolesToPalette(scene.roles);
  const effect = controls.effectMode || "aura";
  const speed = controls.speed || 1;
  const blur = controls.blur ?? 0.64;
  const light = controls.brightness || 1;
  const time = motionState.motionEnabled ? motionState.time * speed : 0;

  drawBase(ctx, width, height, maxSide, palette, light, effect);

  if (effect === "silk") {
    drawSilk(ctx, width, height, minSide, palette, time, blur, light);
  } else if (effect === "liquid") {
    drawLiquid(ctx, width, height, minSide, maxSide, palette, time, blur, light);
  } else if (effect === "nebula") {
    drawNebula(ctx, width, height, minSide, maxSide, palette, time, blur, light);
  } else if (effect === "turbulence") {
    drawTurbulence(ctx, width, height, minSide, palette, time, blur, light);
  } else if (effect === "diffusion") {
    drawDiffusion(ctx, width, height, minSide, maxSide, palette, time, blur, light);
  } else if (effect === "foliage") {
    drawFoliage(ctx, width, height, minSide, palette, time, blur, light);
  } else if (effect === "mist") {
    drawMist(ctx, width, height, minSide, maxSide, palette, time, blur, light);
  } else {
    drawAura(ctx, width, height, minSide, maxSide, palette, time, blur, light);
  }

  drawVignette(ctx, width, height, minSide, maxSide, controls.vignette ?? 0.42);
}

function drawBase(ctx, width, height, maxSide, palette, light, effect) {
  const dark = tuneColor(palette[0], effect === "nebula" ? 0.18 * light : 0.32 * light, 0.8);
  const mid = tuneColor(palette[1], effect === "silk" ? 0.88 * light : 0.72 * light, 1.08);
  const edge = tuneColor(palette[5] || palette[2], effect === "liquid" ? 0.62 * light : 0.46 * light, 1.1);
  const accent = tuneColor(
    palette[3] || palette[1],
    effect === "nebula" ? 0.95 * light : effect === "liquid" ? 0.52 * light : 0.72 * light,
    1.2
  );
  const gradient =
    effect === "liquid" || effect === "nebula"
      ? ctx.createRadialGradient(width * 0.5, height * 0.48, maxSide * 0.05, width * 0.5, height * 0.5, maxSide * 0.8)
      : ctx.createLinearGradient(0, 0, width, height);

  if (effect === "silk") {
    gradient.addColorStop(0, rgba(edge));
    gradient.addColorStop(0.42, rgba(dark));
    gradient.addColorStop(1, rgba(mid));
  } else if (effect === "liquid") {
    gradient.addColorStop(0, rgba(accent));
    gradient.addColorStop(0.45, rgba(edge));
    gradient.addColorStop(1, rgba(dark));
  } else if (effect === "nebula") {
    gradient.addColorStop(0, rgba(accent));
    gradient.addColorStop(0.32, rgba(edge));
    gradient.addColorStop(1, rgba(dark));
  } else {
    gradient.addColorStop(0, rgba(dark));
    gradient.addColorStop(0.45, rgba(edge));
    gradient.addColorStop(1, rgba(mid));
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawAura(ctx, width, height, minSide, maxSide, palette, time, blur, light) {
  ctx.save();
  ctx.filter = `blur(${Math.round(minSide * (0.04 + blur * 0.08))}px) saturate(1.35)`;
  ctx.globalCompositeOperation = "screen";

  for (let index = 0; index < 16; index += 1) {
    const source = palette[index % palette.length];
    const color = tuneColor(source, light * 1.08, 1.16);
    const phase = time * (0.32 + (index % 7) * 0.045) + index * 1.73;
    const x = width * (0.5 + Math.sin(phase * 0.8) * 0.33 + Math.cos(phase * 0.37) * 0.13);
    const y = height * (0.5 + Math.cos(phase * 0.7) * 0.29 + Math.sin(phase * 0.43) * 0.12);
    const radius = maxSide * (0.24 + (index % 5) * 0.052 + Math.sin(phase * 0.8) * 0.025);
    const alpha = 0.16 + (index % 4) * 0.035;
    const gradient = ctx.createRadialGradient(x, y, radius * 0.05, x, y, radius);
    gradient.addColorStop(0, rgba(color, alpha));
    gradient.addColorStop(0.4, rgba(color, alpha * 0.48));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * (1.08 + Math.sin(phase) * 0.14), radius * (0.72 + Math.cos(phase) * 0.12), phase * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawSilk(ctx, width, height, minSide, palette, time, blur, light) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = `blur(${Math.round(minSide * (0.006 + blur * 0.014))}px) saturate(1.35)`;

  for (let band = 0; band < 11; band += 1) {
    const color = tuneColor(palette[band % palette.length], light * 1.05, 1.16);
    const alpha = 0.16 + (band % 3) * 0.035;
    const yBase = height * (0.04 + band * 0.09);
    const gradient = ctx.createLinearGradient(0, yBase - height * 0.12, width, yBase + height * 0.16);
    gradient.addColorStop(0, rgba(color, 0));
    gradient.addColorStop(0.5, rgba(color, alpha));
    gradient.addColorStop(1, rgba(tuneColor(palette[(band + 2) % palette.length], light, 1.08), 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-width * 0.08, yBase);
    const phase = time * (0.32 + band * 0.018) + band * 0.7;
    for (let index = 0; index <= 18; index += 1) {
      const x = width * (index / 18);
      const ribbon = Math.sin(index * 0.72 + phase) * height * 0.07 + Math.sin(index * 1.35 - phase * 0.8) * height * 0.025;
      ctx.lineTo(x, yBase + ribbon);
    }
    for (let index = 18; index >= 0; index -= 1) {
      const x = width * (index / 18);
      const ribbon = Math.sin(index * 0.72 + phase + 0.8) * height * 0.07 + Math.sin(index * 1.35 - phase * 0.8) * height * 0.025;
      ctx.lineTo(x, yBase + ribbon + height * (0.1 + band * 0.002));
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = 0.24;
  ctx.lineWidth = Math.max(1, minSide * 0.0025);
  for (let line = 0; line < 18; line += 1) {
    const y = height * (line / 17);
    ctx.strokeStyle = rgba(tuneColor(palette[(line + 1) % palette.length], light * 1.12, 0.75), 0.42);
    ctx.beginPath();
    for (let x = 0; x <= width; x += width / 26) {
      const offset = Math.sin(x * 0.011 + time * 0.7 + line) * height * 0.012;
      if (x === 0) {
        ctx.moveTo(x, y + offset);
      } else {
        ctx.lineTo(x, y + offset);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawLiquid(ctx, width, height, minSide, maxSide, palette, time, blur, light) {
  ctx.save();
  ctx.filter = `blur(${Math.round(minSide * (0.018 + blur * 0.035))}px) contrast(1.22) saturate(1.55)`;
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < 24; index += 1) {
    const color = tuneColor(palette[index % palette.length], light * 0.92, 1.24);
    const phase = time * (0.23 + index * 0.013) + index * 1.71;
    const x = width * (0.5 + Math.sin(phase * 0.7) * 0.38 + Math.cos(phase * 0.33) * 0.08);
    const y = height * (0.5 + Math.cos(phase * 0.58) * 0.34 + Math.sin(phase * 0.29) * 0.1);
    const radius = maxSide * (0.18 + (index % 5) * 0.045);
    const gradient = ctx.createRadialGradient(x, y, radius * 0.04, x, y, radius);
    gradient.addColorStop(0, rgba(color, 0.3));
    gradient.addColorStop(0.5, rgba(color, 0.18));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * (1.25 + Math.sin(phase) * 0.28), radius * (0.72 + Math.cos(phase * 0.9) * 0.2), phase * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.38;
  ctx.filter = `blur(${Math.round(minSide * 0.01)}px)`;
  for (let ring = 0; ring < 8; ring += 1) {
    const color = tuneColor(palette[(ring + 2) % palette.length], light * 1.2, 0.95);
    ctx.strokeStyle = rgba(color, 0.34);
    ctx.lineWidth = minSide * (0.01 + ring * 0.0012);
    ctx.beginPath();
    const phase = time * 0.5 + ring;
    for (let angle = 0; angle <= Math.PI * 2 + 0.2; angle += 0.1) {
      const radius = minSide * (0.14 + ring * 0.054 + Math.sin(angle * 3 + phase) * 0.02);
      const x = width * 0.5 + Math.cos(angle + phase * 0.1) * radius * 1.45;
      const y = height * 0.52 + Math.sin(angle) * radius;
      if (angle === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawNebula(ctx, width, height, minSide, maxSide, palette, time, blur, light) {
  drawAura(ctx, width, height, minSide, maxSide, palette, time * 0.58, blur * 1.15, light * 0.82);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.42;
  ctx.filter = `blur(${Math.round(minSide * 0.012)}px)`;
  for (let ray = 0; ray < 12; ray += 1) {
    const angle = ray * 0.62 + time * 0.08;
    const color = tuneColor(palette[(ray + 1) % palette.length], light * 1.18, 1.25);
    const gradient = ctx.createLinearGradient(width * 0.5, height * 0.5, width * (0.5 + Math.cos(angle) * 0.72), height * (0.5 + Math.sin(angle) * 0.72));
    gradient.addColorStop(0, rgba(color, 0.36));
    gradient.addColorStop(0.5, rgba(color, 0.09));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.strokeStyle = gradient;
    ctx.lineWidth = minSide * (0.055 + ray * 0.004);
    ctx.beginPath();
    ctx.moveTo(width * 0.5, height * 0.5);
    ctx.lineTo(width * (0.5 + Math.cos(angle) * 0.92), height * (0.5 + Math.sin(angle) * 0.92));
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = `blur(${Math.round(minSide * 0.028)}px)`;
  for (let core = 0; core < 5; core += 1) {
    const color = tuneColor(palette[(core + 2) % palette.length], light * 1.28, 1.4);
    const radius = minSide * (0.12 + core * 0.07);
    const x = width * (0.5 + Math.sin(time * 0.16 + core) * 0.09);
    const y = height * (0.46 + Math.cos(time * 0.14 + core) * 0.08);
    const gradient = ctx.createRadialGradient(x, y, radius * 0.05, x, y, radius);
    gradient.addColorStop(0, rgba(color, 0.34));
    gradient.addColorStop(0.65, rgba(color, 0.12));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTurbulence(ctx, width, height, minSide, palette, time, blur, light) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.filter = `blur(${Math.round(minSide * (0.012 + blur * 0.025))}px) saturate(1.45)`;
  for (let band = 0; band < 22; band += 1) {
    const color = tuneColor(palette[band % palette.length], light * 0.96, 1.26);
    const yBase = height * (band / 21);
    const phase = time * (0.52 + band * 0.015) + band * 1.9;
    const gradient = ctx.createLinearGradient(0, yBase - height * 0.1, width, yBase + height * 0.12);
    gradient.addColorStop(0, rgba(color, 0));
    gradient.addColorStop(0.45, rgba(color, 0.18));
    gradient.addColorStop(1, rgba(tuneColor(palette[(band + 2) % palette.length], light, 1.1), 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, yBase);
    for (let index = 0; index <= 28; index += 1) {
      const x = width * (index / 28);
      const curl = Math.sin(index * 0.75 + phase) * height * 0.055 + Math.sin(index * 1.9 - phase * 0.7) * height * 0.025;
      ctx.lineTo(x, yBase + curl);
    }
    ctx.lineTo(width, yBase + height * 0.16);
    ctx.lineTo(0, yBase + height * 0.16);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawDiffusion(ctx, width, height, minSide, maxSide, palette, time, blur, light) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.filter = `blur(${Math.round(minSide * (0.045 + blur * 0.07))}px) saturate(1.25)`;
  for (let index = 0; index < 16; index += 1) {
    const color = tuneColor(palette[index % palette.length], light * 1.02, 1.12);
    const phase = time * (0.14 + index * 0.01) + index;
    const x = width * (0.5 + Math.sin(phase * 0.9) * 0.42);
    const y = height * (0.5 + Math.cos(phase * 0.7) * 0.36);
    const radius = maxSide * (0.22 + ((index * 3) % 7) * 0.035 + Math.sin(phase) * 0.03);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, rgba(color, 0.22));
    gradient.addColorStop(0.56, rgba(color, 0.1));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFoliage(ctx, width, height, minSide, palette, time, blur, light) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.filter = `blur(${Math.round(minSide * (0.006 + blur * 0.018))}px) saturate(1.22)`;
  for (let layer = 0; layer < 42; layer += 1) {
    const color = tuneColor(palette[(layer + 1) % palette.length], light * (0.78 + (layer % 4) * 0.08), 0.78);
    const phase = time * (0.18 + (layer % 6) * 0.018) + layer * 0.73;
    const x = width * ((layer * 0.618 + Math.sin(phase) * 0.08) % 1);
    const y = height * ((layer * 0.381 + Math.cos(phase * 0.9) * 0.07 + 1) % 1);
    const size = minSide * (0.07 + (layer % 5) * 0.014);
    const gradient = ctx.createRadialGradient(x, y, size * 0.05, x, y, size);
    gradient.addColorStop(0, rgba(color, 0.26));
    gradient.addColorStop(0.55, rgba(color, 0.12));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, size * 1.5, size * 0.42, phase * 0.4 + layer, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMist(ctx, width, height, minSide, maxSide, palette, time, blur, light) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.filter = `blur(${Math.round(minSide * (0.055 + blur * 0.08))}px) saturate(0.95)`;
  for (let cloud = 0; cloud < 13; cloud += 1) {
    const color = tuneColor(palette[cloud % palette.length], light * 1.08, 0.46);
    const phase = time * (0.08 + cloud * 0.006) + cloud * 1.4;
    const x = width * (0.5 + Math.sin(phase) * 0.52);
    const y = height * (0.5 + Math.cos(phase * 0.72) * 0.42);
    const radius = maxSide * (0.24 + (cloud % 4) * 0.055);
    const gradient = ctx.createRadialGradient(x, y, radius * 0.08, x, y, radius);
    gradient.addColorStop(0, rgba(color, 0.2));
    gradient.addColorStop(0.62, rgba(color, 0.09));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.45, radius * 0.65, phase * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVignette(ctx, width, height, minSide, maxSide, vignetteStrength) {
  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.45, minSide * 0.15, width * 0.5, height * 0.5, maxSide * 0.78);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, `rgba(0, 0, 0, ${vignetteStrength})`);
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
