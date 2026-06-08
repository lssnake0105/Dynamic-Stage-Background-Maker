import { serializeScene } from "./scene.js";

export function exportConfig({ scene, settings, exportSize, durationSeconds }) {
  return JSON.stringify(
    {
      version: 1,
      presetId: scene?.presetId || "soft",
      scene: scene ? serializeScene(scene) : null,
      settings,
      export: {
        resolution: exportSize,
        durationSeconds
      }
    },
    null,
    2
  );
}

export function downloadText(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readJsonFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}
