import {
  DEFAULT_EXPORT_SIZE,
  EXPORT_DURATIONS,
  EXPORT_SIZES,
  PRESETS,
  ROLE_KEYS
} from "../core/constants.js";
import { extractPaletteRoles } from "../core/palette.js";
import { createMeshScene, hydrateScene } from "../core/scene.js";
import { createRenderer } from "../core/renderer.js";
import { createTransitionState, getRenderState } from "../core/timeline.js";
import { downloadText, exportConfig, readJsonFile } from "../core/io.js";

export function createApp(root) {
  root.innerHTML = createTemplate();

  const appShell = root.querySelector(".app-shell");
  const previewCanvas = root.querySelector("#visualizer");
  const exportCanvas = root.querySelector("#exportCanvas");
  const hero = root.querySelector("#hero");
  const heroUploadButton = root.querySelector("#heroUploadButton");
  const heroOpenPanelButton = root.querySelector("#heroOpenPanelButton");
  const toolbarUploadButton = root.querySelector("#toolbarUploadButton");
  const toolbarFullscreenButton = root.querySelector("#toolbarFullscreenButton");
  const toolbarExportButton = root.querySelector("#toolbarExportButton");
  const toolbarPanelButton = root.querySelector("#toolbarPanelButton");
  const panel = root.querySelector("#controlPanel");
  const presetGrid = root.querySelector("#presetGrid");
  const paletteGrid = root.querySelector("#paletteGrid");
  const artworkImage = root.querySelector("#artworkImage");
  const artworkBadge = root.querySelector("#artworkBadge");
  const statusText = root.querySelector("#statusText");
  const motionBadge = root.querySelector("#motionBadge");
  const outputInfo = root.querySelector("#outputInfo");
  const coverInput = root.querySelector("#coverInput");
  const configInput = root.querySelector("#configInput");
  const importButton = root.querySelector("#importConfigButton");
  const exportConfigButton = root.querySelector("#exportConfigButton");
  const resetButton = root.querySelector("#resetButton");
  const configPreview = root.querySelector("#configPreview");

  const controls = {
    preset: root.querySelector("#presetSelect"),
    brightness: root.querySelector("#brightnessRange"),
    motionStrength: root.querySelector("#motionRange"),
    grain: root.querySelector("#grainRange"),
    meshDensity: root.querySelector("#meshDensityRange"),
    meshAmplitude: root.querySelector("#meshAmplitudeRange"),
    transitionDuration: root.querySelector("#transitionRange"),
    cycleDuration: root.querySelector("#cycleRange"),
    colorSmoothness: root.querySelector("#smoothnessRange"),
    haze: root.querySelector("#hazeRange"),
    vignette: root.querySelector("#vignetteRange"),
    resolution: root.querySelector("#resolutionSelect"),
    duration: root.querySelector("#durationSelect"),
    motionMode: root.querySelector("#motionModeSelect")
  };

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const urlParams = new URLSearchParams(window.location.search);

  const state = {
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    source: { type: "image", fileName: "" },
    artworkUrl: "",
    palette: null,
    scene: null,
    transition: createTransitionState(null, null, performance.now(), 0),
    isPanelOpen: urlParams.get("panel") === "1",
    exportSize: getExportSize(DEFAULT_EXPORT_SIZE),
    settings: {
      presetId: "soft",
      brightness: PRESETS.soft.settings.brightness,
      motionStrength: PRESETS.soft.settings.motionStrength,
      grain: PRESETS.soft.settings.grain,
      meshDensity: PRESETS.soft.settings.meshDensity,
      meshAmplitude: PRESETS.soft.settings.meshAmplitude,
      transitionDuration: PRESETS.soft.settings.transitionDuration,
      cycleDuration: PRESETS.soft.settings.cycleDuration,
      colorSmoothness: PRESETS.soft.settings.colorSmoothness,
      haze: PRESETS.soft.settings.haze,
      vignette: PRESETS.soft.settings.vignette,
      durationSeconds: 10,
      motionMode: urlParams.get("motion") === "off" ? "static" : "auto"
    },
    reducedMotion: prefersReducedMotion.matches
  };

  const renderer = createRenderer({
    previewCanvas,
    exportCanvas,
    getDevicePixelRatio: () => state.dpr
  });

  populatePresetGrid(presetGrid, state.settings.presetId);
  populatePresetSelect(controls.preset, state.settings.presetId);
  populateResolutionOptions(controls.resolution, state.exportSize.value);
  populateDurationOptions(controls.duration, state.settings.durationSeconds);
  controls.motionMode.value = state.settings.motionMode;
  syncControlValues();
  syncUi();

  heroUploadButton.addEventListener("click", () => coverInput.click());
  heroOpenPanelButton.addEventListener("click", () => {
    state.isPanelOpen = true;
    syncUi();
  });
  toolbarUploadButton.addEventListener("click", () => coverInput.click());
  toolbarFullscreenButton.addEventListener("click", toggleFullscreen);
  toolbarExportButton.addEventListener("click", startRecording);
  toolbarPanelButton.addEventListener("click", () => {
    state.isPanelOpen = !state.isPanelOpen;
    syncUi();
  });
  resetButton.addEventListener("click", resetExperience);
  exportConfigButton.addEventListener("click", handleExportConfig);
  importButton.addEventListener("click", () => configInput.click());

  coverInput.addEventListener("change", async (event) => {
    await handleArtworkFile(event.target.files[0]);
  });
  configInput.addEventListener("change", async (event) => {
    await handleConfigFile(event.target.files[0]);
  });

  panel.addEventListener("input", handleControlInput);
  presetGrid.addEventListener("click", (event) => {
    const target = event.target.closest("[data-preset-id]");
    if (!target) {
      return;
    }
    applyPreset(target.dataset.presetId, true);
  });

  hero.addEventListener("dragover", (event) => {
    event.preventDefault();
    hero.dataset.dragging = "true";
  });
  hero.addEventListener("dragleave", () => {
    hero.dataset.dragging = "false";
  });
  hero.addEventListener("drop", async (event) => {
    event.preventDefault();
    hero.dataset.dragging = "false";
    await handleArtworkFile(event.dataTransfer.files[0]);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "p") {
      state.isPanelOpen = !state.isPanelOpen;
      syncUi();
    }
  });

  prefersReducedMotion.addEventListener("change", (event) => {
    state.reducedMotion = event.matches;
    syncUi();
  });

  window.addEventListener("resize", () => {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.resizePreview();
  });

  renderer.onRecordingStop(({ blobUrl, mimeType }) => {
    toolbarExportButton.textContent = "Export";
    appShell.dataset.recording = "false";
    if (!blobUrl) {
      syncStatus();
      return;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const extension = mimeType.includes("webm") ? "webm" : "bin";
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `stage-background-${state.exportSize.label}-${state.settings.durationSeconds}s-${stamp}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    statusText.textContent = "Export complete.";
  });

  function handleControlInput(event) {
    const target = event.target;
    if (!target.id) {
      return;
    }

    if (target === controls.preset) {
      applyPreset(target.value, true);
      return;
    }

    if (target === controls.resolution) {
      state.exportSize = getExportSize(target.value);
      syncUi();
      return;
    }

    if (target === controls.duration) {
      state.settings.durationSeconds = Number(target.value);
      syncUi();
      return;
    }

    if (target === controls.motionMode) {
      state.settings.motionMode = target.value;
      syncUi();
      return;
    }

    const map = {
      brightnessRange: "brightness",
      motionRange: "motionStrength",
      grainRange: "grain",
      meshDensityRange: "meshDensity",
      meshAmplitudeRange: "meshAmplitude",
      transitionRange: "transitionDuration",
      cycleRange: "cycleDuration",
      smoothnessRange: "colorSmoothness",
      hazeRange: "haze",
      vignetteRange: "vignette"
    };

    const key = map[target.id];
    if (!key) {
      return;
    }

    state.settings[key] = Number(target.value);
    rebuildScene(false);
    syncUi();
  }

  async function handleArtworkFile(file) {
    if (!file || !file.type?.startsWith("image/")) {
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    try {
      const image = await loadImage(imageUrl);
      revokeArtworkUrl();
      state.artworkUrl = imageUrl;
      state.source = { type: "image", fileName: file.name };
      state.palette = extractPaletteRoles(image);
      artworkImage.src = imageUrl;
      artworkBadge.textContent = file.name;
      rebuildScene(true);
      syncUi();
    } catch (error) {
      URL.revokeObjectURL(imageUrl);
      statusText.textContent = "Unable to load this image.";
    }
  }

  async function handleConfigFile(file) {
    if (!file) {
      return;
    }

    try {
      const payload = await readJsonFile(file);
      if (!payload?.scene || !payload?.settings || !payload?.export) {
        throw new Error("Invalid config");
      }
      state.palette = payload.scene.roles;
      state.scene = hydrateScene(payload.scene);
      state.settings = {
        ...state.settings,
        ...payload.settings
      };
      state.exportSize = getExportSize(payload.export.resolution?.value || payload.export.resolution || DEFAULT_EXPORT_SIZE);
      state.settings.durationSeconds = payload.export.durationSeconds || state.settings.durationSeconds;
      state.transition = createTransitionState(null, state.scene, performance.now(), 0);
      state.isPanelOpen = true;
      artworkImage.removeAttribute("src");
      artworkBadge.textContent = `Config: ${file.name}`;
      syncControlValues();
      populatePresetGrid(presetGrid, state.settings.presetId);
      syncUi();
    } catch (error) {
      statusText.textContent = "Invalid config JSON.";
    }
  }

  function handleExportConfig() {
    if (!state.scene) {
      statusText.textContent = "Load artwork before exporting config.";
      return;
    }

    const serialized = exportConfig({
      scene: state.scene,
      settings: { ...state.settings },
      exportSize: state.exportSize,
      durationSeconds: state.settings.durationSeconds
    });
    configPreview.value = serialized;
    downloadText(`stage-background-config-${state.settings.presetId}.json`, serialized, "application/json");
    statusText.textContent = "Config exported.";
  }

  function applyPreset(presetId, rebuild) {
    const preset = PRESETS[presetId] || PRESETS.soft;
    state.settings = {
      ...state.settings,
      presetId: preset.id,
      ...preset.settings,
      durationSeconds: state.settings.durationSeconds,
      motionMode: state.settings.motionMode
    };
    syncControlValues();
    populatePresetGrid(presetGrid, preset.id);
    controls.preset.value = preset.id;
    if (rebuild) {
      rebuildScene(Boolean(state.palette));
    }
    syncUi();
  }

  function rebuildScene(withTransition) {
    if (!state.palette) {
      state.scene = null;
      state.transition = createTransitionState(null, null, performance.now(), 0);
      return;
    }

    const previous = state.scene;
    const nextScene = createMeshScene(state.palette, state.settings.presetId, state.settings);
    state.scene = nextScene;
    state.transition = createTransitionState(
      withTransition ? previous : null,
      nextScene,
      performance.now(),
      withTransition ? 650 : 0
    );
  }

  function startRecording() {
    if (renderer.isRecording()) {
      renderer.stopRecording();
      return;
    }
    if (!state.scene) {
      statusText.textContent = "Load artwork before exporting.";
      return;
    }

    const result = renderer.startRecording({
      size: state.exportSize,
      durationSeconds: state.settings.durationSeconds
    });
    if (!result.ok) {
      statusText.textContent = result.reason;
      return;
    }
    toolbarExportButton.textContent = "Stop";
    appShell.dataset.recording = "true";
    statusText.textContent = `Exporting ${state.exportSize.label} - ${state.settings.durationSeconds}s`;
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await appShell.requestFullscreen();
      return;
    }
    await document.exitFullscreen();
  }

  function resetExperience() {
    revokeArtworkUrl();
    state.source = { type: "image", fileName: "" };
    state.palette = null;
    state.scene = null;
    state.transition = createTransitionState(null, null, performance.now(), 0);
    state.exportSize = getExportSize(DEFAULT_EXPORT_SIZE);
    state.settings = {
      ...state.settings,
      presetId: "soft",
      ...PRESETS.soft.settings,
      durationSeconds: 10,
      motionMode: urlParams.get("motion") === "off" ? "static" : "auto"
    };
    coverInput.value = "";
    configInput.value = "";
    artworkImage.removeAttribute("src");
    artworkBadge.textContent = "No artwork loaded";
    configPreview.value = "";
    syncControlValues();
    populatePresetGrid(presetGrid, state.settings.presetId);
    syncUi();
  }

  function syncUi() {
    appShell.dataset.hasScene = state.scene ? "true" : "false";
    appShell.dataset.recording = renderer.isRecording() ? "true" : "false";
    panel.hidden = !state.isPanelOpen;
    toolbarPanelButton.classList.toggle("is-active", state.isPanelOpen);
    outputInfo.textContent = `Export size: ${state.exportSize.width} x ${state.exportSize.height}`;
    renderPalette();
    renderConfigPreview();
    syncStatus();
  }

  function syncStatus() {
    const motionLabel = isMotionEnabled() ? "motion active" : "static fallback";
    statusText.textContent = state.scene
      ? `${state.source.fileName || state.scene.presetId} - ${motionLabel}`
      : "Upload artwork to generate a dynamic stage background.";
    motionBadge.textContent = getMotionLabel();
  }

  function renderPalette() {
    paletteGrid.innerHTML = "";
    if (!state.palette) {
      return;
    }
    ROLE_KEYS.forEach((key) => {
      const color = state.palette[key];
      const swatch = document.createElement("div");
      swatch.className = "swatch";
      swatch.innerHTML = `<span>${key}</span>`;
      swatch.style.background = `rgb(${Math.round(color.r)} ${Math.round(color.g)} ${Math.round(color.b)})`;
      paletteGrid.appendChild(swatch);
    });
  }

  function renderConfigPreview() {
    if (!state.scene) {
      configPreview.value = "";
      return;
    }
    configPreview.value = exportConfig({
      scene: state.scene,
      settings: { ...state.settings },
      exportSize: state.exportSize,
      durationSeconds: state.settings.durationSeconds
    });
  }

  function syncControlValues() {
    controls.preset.value = state.settings.presetId;
    controls.brightness.value = state.settings.brightness;
    controls.motionStrength.value = state.settings.motionStrength;
    controls.grain.value = state.settings.grain;
    controls.meshDensity.value = state.settings.meshDensity;
    controls.meshAmplitude.value = state.settings.meshAmplitude;
    controls.transitionDuration.value = state.settings.transitionDuration;
    controls.cycleDuration.value = state.settings.cycleDuration;
    controls.colorSmoothness.value = state.settings.colorSmoothness;
    controls.haze.value = state.settings.haze;
    controls.vignette.value = state.settings.vignette;
    controls.resolution.value = state.exportSize.value;
    controls.duration.value = String(state.settings.durationSeconds);
    controls.motionMode.value = state.settings.motionMode;
  }

  function isMotionEnabled() {
    if (state.settings.motionMode === "static") {
      return false;
    }
    if (state.settings.motionMode === "dynamic") {
      return true;
    }
    return !state.reducedMotion;
  }

  function getMotionLabel() {
    if (state.settings.motionMode === "static") {
      return "Static mode";
    }
    if (state.settings.motionMode === "dynamic") {
      return "Forced dynamic";
    }
    return state.reducedMotion ? "Reduce Motion detected" : "Motion active";
  }

  function revokeArtworkUrl() {
    if (!state.artworkUrl) {
      return;
    }
    URL.revokeObjectURL(state.artworkUrl);
    state.artworkUrl = "";
  }

  function tick(now) {
    renderer.resizePreview();
    const renderState = getRenderState({
      scene: state.scene,
      transition: state.transition,
      now,
      motionEnabled: isMotionEnabled(),
      motionStrength: state.settings.motionStrength
    });
    renderer.renderPreview(renderState, state.settings);
    if (renderer.isRecording()) {
      renderer.renderExport(renderState, state.settings);
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function createTemplate() {
  return `
    <main class="app-shell" data-has-scene="false" data-recording="false">
      <canvas class="stage-canvas" id="visualizer" aria-label="Dynamic stage background canvas"></canvas>
      <canvas id="exportCanvas" width="1280" height="720" hidden></canvas>

      <section class="hero" id="hero" data-dragging="false">
        <div class="hero-panel">
          <p class="eyebrow">Dynamic Stage Background Maker</p>
          <h1>Dynamic stage background generator</h1>
          <p class="hero-copy">
            Upload artwork, tune palette-driven motion, and export reusable video backdrops for screens, performances, and live visuals.
          </p>
          <div class="hero-actions">
            <button class="button" type="button" id="heroUploadButton">Upload Artwork</button>
            <button class="button-ghost" type="button" id="heroOpenPanelButton">Open Panel</button>
          </div>
          <p class="hero-note">Drop a local image here or keep the panel open for presets, motion controls, export, and config I/O.</p>
        </div>
      </section>

      <header class="toolbar" aria-label="Primary toolbar">
        <div class="toolbar-group">
          <button class="toolbar-button" type="button" id="toolbarUploadButton">Upload</button>
          <button class="toolbar-button" type="button" id="toolbarFullscreenButton">Fullscreen</button>
          <button class="toolbar-button is-accent" type="button" id="toolbarExportButton">Export</button>
          <button class="toolbar-button" type="button" id="toolbarPanelButton">Panel</button>
        </div>
      </header>

      <section class="status-bar">
        <p id="statusText">Upload artwork to generate a dynamic stage background.</p>
        <p id="motionBadge">Motion active</p>
      </section>

      <aside class="artwork-card">
        <img id="artworkImage" alt="" />
        <div>
          <p class="artwork-label">Source artwork</p>
          <p class="artwork-file" id="artworkBadge">No artwork loaded</p>
        </div>
      </aside>

      <aside class="panel" id="controlPanel" hidden>
        <div class="panel-header">
          <div>
            <p class="eyebrow">Stage Background Maker</p>
            <h2>Presets, motion controls, export</h2>
          </div>
          <div class="panel-actions">
            <button class="button-ghost" type="button" id="resetButton">Reset</button>
          </div>
        </div>

        <section class="control-stack">
          <div>
            <p class="section-hint">Preset families</p>
            <div class="preset-grid" id="presetGrid"></div>
          </div>
          <label>
            Preset
            <select id="presetSelect"></select>
          </label>
        </section>

        <section class="control-stack">
          <p class="section-hint">Basic controls</p>
          <div class="advanced-grid">
            <label>
              Brightness
              <input id="brightnessRange" type="range" min="0.72" max="1.18" step="0.01" />
            </label>
            <label>
              Motion
              <input id="motionRange" type="range" min="0" max="1.4" step="0.02" />
            </label>
            <label>
              Grain
              <input id="grainRange" type="range" min="0" max="0.08" step="0.002" />
            </label>
            <label>
              Motion Mode
              <select id="motionModeSelect">
                <option value="auto">Auto</option>
                <option value="dynamic">Dynamic</option>
                <option value="static">Static</option>
              </select>
            </label>
          </div>
        </section>

        <section class="control-stack">
          <p class="section-hint">Advanced mesh controls</p>
          <div class="advanced-grid">
            <label>
              Mesh Density
              <input id="meshDensityRange" type="range" min="3" max="6" step="1" />
            </label>
            <label>
              Mesh Amplitude
              <input id="meshAmplitudeRange" type="range" min="0.01" max="0.06" step="0.002" />
            </label>
            <label>
              Transition Duration
              <input id="transitionRange" type="range" min="2" max="8" step="0.1" />
            </label>
            <label>
              Cycle Duration
              <input id="cycleRange" type="range" min="10" max="30" step="0.5" />
            </label>
            <label>
              Color Smoothness
              <input id="smoothnessRange" type="range" min="0.3" max="0.95" step="0.01" />
            </label>
            <label>
              Haze
              <input id="hazeRange" type="range" min="0" max="0.4" step="0.01" />
            </label>
            <label>
              Vignette
              <input id="vignetteRange" type="range" min="0.2" max="0.7" step="0.01" />
            </label>
          </div>
        </section>

        <section class="control-stack">
          <p class="section-hint">Palette roles</p>
          <div class="palette-grid" id="paletteGrid"></div>
        </section>

        <section class="control-stack">
          <p class="section-hint">Export</p>
          <div class="export-grid">
            <label>
              Resolution
              <select id="resolutionSelect"></select>
            </label>
            <label>
              Duration
              <select id="durationSelect"></select>
            </label>
          </div>
          <p class="panel-note" id="outputInfo">Export size: 1280 x 720</p>
        </section>

        <section class="control-stack">
          <p class="section-hint">Config JSON</p>
          <div class="file-row">
            <button class="file-button" type="button" id="exportConfigButton">Export Config</button>
            <button class="file-button" type="button" id="importConfigButton">Import Config</button>
          </div>
          <textarea id="configPreview" spellcheck="false" placeholder="Scene config JSON preview"></textarea>
        </section>
      </aside>

      <input class="hidden-input" id="coverInput" type="file" accept="image/*" />
      <input class="hidden-input" id="configInput" type="file" accept="application/json,.json" />
    </main>
  `;
}

function populatePresetGrid(container, activeId) {
  container.innerHTML = Object.values(PRESETS)
    .map((preset) => `
      <button class="preset-button ${preset.id === activeId ? "is-active" : ""}" type="button" data-preset-id="${preset.id}">
        <strong>${preset.name}</strong>
        <span class="preset-copy">${preset.description}</span>
      </button>
    `)
    .join("");
}

function populatePresetSelect(select, activeId) {
  select.innerHTML = Object.values(PRESETS)
    .map((preset) => `<option value="${preset.id}" ${preset.id === activeId ? "selected" : ""}>${preset.name}</option>`)
    .join("");
}

function populateResolutionOptions(select, activeValue) {
  select.innerHTML = EXPORT_SIZES
    .map((item) => `<option value="${item.value}" ${item.value === activeValue ? "selected" : ""}>${item.label}</option>`)
    .join("");
}

function populateDurationOptions(select, activeValue) {
  select.innerHTML = EXPORT_DURATIONS
    .map((value) => `<option value="${value}" ${value === activeValue ? "selected" : ""}>${value}s</option>`)
    .join("");
}

function getExportSize(value) {
  const match = EXPORT_SIZES.find((item) => item.value === value) || EXPORT_SIZES[1];
  const [width, height] = match.value.split("x").map(Number);
  return {
    ...match,
    width,
    height
  };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}
