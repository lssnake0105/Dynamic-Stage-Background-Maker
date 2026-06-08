import { clamp, mixColor, rgba, tuneColor } from "./color.js";
import { drawEffectScene } from "./effects.js";

export function createRenderer({ previewCanvas, exportCanvas, getDevicePixelRatio }) {
  const previewCtx = previewCanvas.getContext("2d", { alpha: false });
  const exportCtx = exportCanvas.getContext("2d", { alpha: false });
  const previewBuffers = createBuffers();
  const exportBuffers = createBuffers();
  let mediaRecorder = null;
  let recordedChunks = [];
  let stopListener = () => {};

  function resizePreview() {
    const rect = previewCanvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * getDevicePixelRatio()));
    const height = Math.max(1, Math.round(rect.height * getDevicePixelRatio()));
    if (previewCanvas.width !== width || previewCanvas.height !== height) {
      previewCanvas.width = width;
      previewCanvas.height = height;
    }
  }

  function renderPreview(renderState, controls) {
    renderToContext(previewCtx, previewCanvas.width, previewCanvas.height, previewBuffers, renderState, controls);
  }

  function renderExport(renderState, controls) {
    renderToContext(exportCtx, exportCanvas.width, exportCanvas.height, exportBuffers, renderState, controls);
  }

  function startRecording({ size, durationSeconds }) {
    if (!exportCanvas.captureStream || typeof MediaRecorder === "undefined") {
      return { ok: false, reason: "MediaRecorder is not available in this browser." };
    }

    exportCanvas.width = size.width;
    exportCanvas.height = size.height;
    recordedChunks = [];
    const stream = exportCanvas.captureStream(30);
    const options = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? { mimeType: "video/webm;codecs=vp9" }
      : { mimeType: "video/webm" };

    mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    mediaRecorder.onstop = () => {
      const blob = recordedChunks.length ? new Blob(recordedChunks, { type: options.mimeType }) : null;
      stopListener({
        blobUrl: blob ? URL.createObjectURL(blob) : "",
        mimeType: options.mimeType
      });
      mediaRecorder = null;
    };
    mediaRecorder.start();
    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
    }, durationSeconds * 1000);
    return { ok: true };
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
  }

  function isRecording() {
    return Boolean(mediaRecorder && mediaRecorder.state === "recording");
  }

  function onRecordingStop(listener) {
    stopListener = listener;
  }

  return {
    resizePreview,
    renderPreview,
    renderExport,
    startRecording,
    stopRecording,
    isRecording,
    onRecordingStop
  };
}

function createBuffers() {
  return {
    primary: document.createElement("canvas"),
    secondary: document.createElement("canvas"),
    noise: document.createElement("canvas"),
    noiseStamp: 0
  };
}

function renderToContext(ctx, width, height, buffers, renderState, controls) {
  if (!width || !height) {
    return;
  }

  if (!renderState.scene) {
    drawPlaceholder(ctx, width, height);
    return;
  }

  if (renderState.transition.fromScene && renderState.transition.mix < 1) {
    const first = prepareBuffer(buffers.primary, width, height);
    const second = prepareBuffer(buffers.secondary, width, height);
    drawScene(first.getContext("2d", { alpha: false }), width, height, renderState.transition.fromScene, renderState.motion, controls);
    drawScene(second.getContext("2d", { alpha: false }), width, height, renderState.scene, renderState.motion, controls);
    ctx.globalAlpha = 1;
    ctx.drawImage(first, 0, 0);
    ctx.globalAlpha = renderState.transition.mix;
    ctx.drawImage(second, 0, 0);
    ctx.globalAlpha = 1;
  } else {
    drawScene(ctx, width, height, renderState.scene, renderState.motion, controls);
  }

  applyNoise(ctx, width, height, buffers, controls.grain, renderState.now);
}

function drawScene(ctx, width, height, scene, motionState, controls) {
  const minSide = Math.min(width, height);
  const maxSide = Math.max(width, height);
  const palette = scene.roles;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  if (controls.effectMode && controls.effectMode !== "mesh") {
    drawEffectScene(ctx, width, height, scene, motionState, controls);
  } else {
    ctx.fillStyle = createBaseGradient(ctx, width, height, maxSide, palette, controls.brightness);
    ctx.fillRect(0, 0, width, height);
    drawMeshLayer(ctx, width, height, scene, motionState, controls);
    drawAtmosphere(ctx, width, height, minSide, maxSide, palette, controls);
    drawVignette(ctx, width, height, minSide, maxSide, controls.vignette);
  }
  ctx.restore();
}

function drawMeshLayer(ctx, width, height, scene, motionState, controls) {
  const layers = [];
  if (!motionState.motionEnabled) {
    layers.push({ key: "a", alpha: 1 });
  } else {
    layers.push({ key: motionState.baseKey, alpha: motionState.baseAlpha });
    if (motionState.nextAlpha > 0.001) {
      layers.push({ key: motionState.nextKey, alpha: motionState.nextAlpha });
    }
  }

  layers.forEach(({ key, alpha }) => {
    const mesh = scene.keyframes[key];
    drawMeshKeyframe(ctx, width, height, mesh, motionState, controls, scene.settings, alpha);
  });
}

function drawMeshKeyframe(ctx, width, height, mesh, motionState, controls, sceneSettings, alpha) {
  const density = mesh.density;
  const points = mesh.points.map((point) => resolveMeshPoint(point, motionState, sceneSettings));
  const smoothness = clamp(controls.colorSmoothness, 0.3, 0.95);

  for (let row = 0; row < density - 1; row += 1) {
    for (let column = 0; column < density - 1; column += 1) {
      const index = row * density + column;
      const topLeft = points[index];
      const topRight = points[index + 1];
      const bottomLeft = points[index + density];
      const bottomRight = points[index + density + 1];

      const centerX = ((topLeft.position.x + topRight.position.x + bottomLeft.position.x + bottomRight.position.x) / 4) * width;
      const centerY = ((topLeft.position.y + topRight.position.y + bottomLeft.position.y + bottomRight.position.y) / 4) * height;

      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        Math.min(width, height) * 0.02,
        centerX,
        centerY,
        Math.max(width, height) * 0.5
      );

      const edgeColor = mixColor(
        mixColor(topLeft.color, topRight.color, 0.5),
        mixColor(bottomLeft.color, bottomRight.color, 0.5),
        0.5
      );
      const boosted = tuneColor(edgeColor, 0.88 + smoothness * 0.2, 0.94 + smoothness * 0.1);

      gradient.addColorStop(0, rgba(boosted, alpha * 0.92));
      gradient.addColorStop(0.35, rgba(edgeColor, alpha * (0.56 + smoothness * 0.12)));
      gradient.addColorStop(1, rgba(edgeColor, 0));

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(topLeft.position.x * width, topLeft.position.y * height);
      ctx.lineTo(topRight.position.x * width, topRight.position.y * height);
      ctx.lineTo(bottomRight.position.x * width, bottomRight.position.y * height);
      ctx.lineTo(bottomLeft.position.x * width, bottomLeft.position.y * height);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

function resolveMeshPoint(point, motionState, sceneSettings) {
  if (!motionState.motionEnabled) {
    return point;
  }
  const amplitude = sceneSettings.meshAmplitude * motionState.motionStrength;
  const angle = motionState.time / (16 + point.drift.x * 8) + point.drift.phase;

  return {
    ...point,
    position: {
      x: clamp(point.position.x + Math.sin(angle) * amplitude * point.drift.x, 0, 1),
      y: clamp(point.position.y + Math.cos(angle * 0.9) * amplitude * point.drift.y, 0, 1)
    }
  };
}

function createBaseGradient(ctx, width, height, maxSide, palette, brightness) {
  const gradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.42,
    maxSide * 0.08,
    width * 0.5,
    height * 0.5,
    maxSide * 0.88
  );
  gradient.addColorStop(0, rgba(tuneColor(palette.secondary, 0.76 * brightness, 0.9), 1));
  gradient.addColorStop(0.45, rgba(tuneColor(palette.baseDark, 0.94 * brightness, 0.84), 1));
  gradient.addColorStop(1, rgba(tuneColor(palette.baseDark, 0.58 * brightness, 0.8), 1));
  return gradient;
}

function drawAtmosphere(ctx, width, height, minSide, maxSide, palette, controls) {
  const topMist = ctx.createLinearGradient(0, 0, 0, height * 0.62);
  const mistColor = mixColor(
    tuneColor(palette.highlight, controls.brightness * 1.08, 0.72),
    tuneColor(palette.support, controls.brightness * 0.92, 0.84),
    0.42
  );

  topMist.addColorStop(0, rgba(mistColor, controls.haze));
  topMist.addColorStop(0.55, rgba(mistColor, controls.haze * 0.22));
  topMist.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = topMist;
  ctx.fillRect(0, 0, width, height * 0.68);

  const halo = ctx.createRadialGradient(
    width * 0.5,
    height * 0.46,
    minSide * 0.08,
    width * 0.5,
    height * 0.52,
    maxSide * 0.78
  );

  halo.addColorStop(0, rgba(palette.highlight, 0.12));
  halo.addColorStop(0.45, rgba(palette.accent, 0.06));
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);
}

function drawVignette(ctx, width, height, minSide, maxSide, vignetteStrength) {
  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.48,
    minSide * 0.18,
    width * 0.5,
    height * 0.5,
    maxSide * 0.86
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, `rgba(0, 0, 0, ${vignetteStrength})`);
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function applyNoise(ctx, width, height, buffers, amount, now) {
  if (amount <= 0.001) {
    return;
  }

  if (now - buffers.noiseStamp > 140 || buffers.noise.width === 0) {
    const size = Math.max(256, Math.min(1024, Math.round(Math.max(width, height) / 2)));
    buffers.noise.width = size;
    buffers.noise.height = size;
    const noiseCtx = buffers.noise.getContext("2d", { willReadFrequently: true });
    const image = noiseCtx.createImageData(size, size);

    for (let index = 0; index < image.data.length; index += 4) {
      const value = 120 + Math.random() * 32;
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 80;
    }

    noiseCtx.putImageData(image, 0, 0);
    buffers.noiseStamp = now;
  }

  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = amount * 0.5;
  ctx.drawImage(buffers.noise, 0, 0, width, height);
  ctx.restore();
}

function prepareBuffer(canvas, width, height) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return canvas;
}

function drawPlaceholder(ctx, width, height) {
  const gradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    width * 0.08,
    width * 0.5,
    height * 0.5,
    width * 0.9
  );
  gradient.addColorStop(0, "rgb(53, 61, 80)");
  gradient.addColorStop(0.42, "rgb(20, 26, 38)");
  gradient.addColorStop(1, "rgb(7, 9, 14)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
