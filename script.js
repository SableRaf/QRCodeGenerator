const PRESET_COLORS = [
  "#111113",
  "#FFFFFF",
  "#EF4444",
  "#F97316",
  "#F5B50A",
  "#22C55E",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
];

const PREVIEW_SIZE = 320;
const CUSTOM_SIZES = [128, 160, 192, 224, 256, 320, 384, 512, 768, 1024, 2048, 4096];
const FORMAT_META = {
  png: { extension: "png", mime: "image/png", label: "PNG" },
  jpg: { extension: "jpg", mime: "image/jpeg", label: "JPG" },
  svg: { extension: "svg", mime: "image/svg+xml", label: "SVG" },
  pdf: { extension: "pdf", mime: "application/pdf", label: "PDF" },
};

const elements = {
  content: document.querySelector("#content"),
  color: document.querySelector("#color"),
  hex: document.querySelector("#hex"),
  swatches: document.querySelector("#swatches"),
  transparent: document.querySelector("#transparent"),
  transparentSwitch: document.querySelector("#transparent").closest(".switch"),
  exportSizes: document.querySelector("#export-sizes"),
  exportFormats: document.querySelector("#export-formats"),
  pixelSize: document.querySelector("#pixel-size"),
  customSizeControl: document.querySelector("#custom-size-control"),
  plate: document.querySelector("#plate"),
  preview: document.querySelector("#preview"),
  download: document.querySelector("#download"),
  downloadLabel: document.querySelector("#download-label"),
  copy: document.querySelector("#copy"),
  exportDialog: document.querySelector("#export-dialog"),
  exportDialogTitle: document.querySelector("#export-dialog-title"),
  exportDialogInstruction: document.querySelector("#export-dialog-instruction"),
  exportDialogImage: document.querySelector("#export-dialog-image"),
  exportDialogClose: document.querySelector("#export-dialog-close"),
  toast: document.querySelector("#toast"),
};

let activeColor = elements.color.value.toUpperCase();
let activeSize = 512;
let activeSizeMode = "preset";
let activeFormat = "png";
let preferredTransparency = elements.transparent.checked;
let currentQr = null;
let toastTimer;
let dialogTrigger;
let dialogObjectUrl;

function normalizeHex(value) {
  const compact = value.trim().replace(/^#/, "");

  if (/^[0-9a-f]{3}$/i.test(compact)) {
    return `#${compact.split("").map((character) => character.repeat(2)).join("")}`.toUpperCase();
  }

  if (/^[0-9a-f]{6}$/i.test(compact)) {
    return `#${compact}`.toUpperCase();
  }

  return null;
}

function updateSwatches() {
  elements.swatches.querySelectorAll(".swatch").forEach((swatch) => {
    swatch.setAttribute("aria-pressed", String(swatch.dataset.color === activeColor));
  });
}

function setColor(value) {
  const normalized = normalizeHex(value);
  if (!normalized) return false;

  activeColor = normalized;
  elements.color.value = normalized;
  elements.hex.value = normalized;
  elements.hex.setAttribute("aria-invalid", "false");
  updateSwatches();
  renderQRCode();
  return true;
}

function createSwatches() {
  PRESET_COLORS.forEach((color) => {
    const swatch = document.createElement("button");
    swatch.className = "swatch";
    swatch.type = "button";
    swatch.dataset.color = color;
    swatch.dataset.light = String(color === "#FFFFFF");
    swatch.style.color = color;
    swatch.setAttribute("aria-label", `Use ${color}`);
    swatch.addEventListener("click", () => setColor(color));
    elements.swatches.append(swatch);
  });

  updateSwatches();
}

function drawQRCode(canvas, qr, size, transparent) {
  const context = canvas.getContext("2d");
  const moduleCount = qr.getModuleCount();
  const quietZone = 4;
  const gridSize = moduleCount + quietZone * 2;

  canvas.width = size;
  canvas.height = size;

  context.clearRect(0, 0, size, size);
  if (!transparent) {
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, size, size);
  }

  context.fillStyle = activeColor;
  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (!qr.isDark(row, column)) continue;

      const left = Math.round(((column + quietZone) * size) / gridSize);
      const top = Math.round(((row + quietZone) * size) / gridSize);
      const right = Math.round(((column + quietZone + 1) * size) / gridSize);
      const bottom = Math.round(((row + quietZone + 1) * size) / gridSize);
      context.fillRect(left, top, right - left, bottom - top);
    }
  }
}

function renderQRCode() {
  const content = elements.content.value;
  elements.plate.classList.toggle("is-transparent", elements.transparent.checked);

  if (!content.trim()) {
    const context = elements.preview.getContext("2d");
    context.clearRect(0, 0, elements.preview.width, elements.preview.height);
    currentQr = null;
    elements.content.setAttribute("aria-invalid", "true");
    elements.download.disabled = true;
    elements.copy.disabled = true;
    return;
  }

  if (typeof qrcode !== "function") {
    currentQr = null;
    elements.download.disabled = true;
    elements.copy.disabled = true;
    return;
  }

  try {
    const qr = qrcode(0, "M");
    qr.addData(content);
    qr.make();
    currentQr = qr;
    drawQRCode(elements.preview, qr, PREVIEW_SIZE, elements.transparent.checked);

    elements.content.setAttribute("aria-invalid", "false");
    elements.download.disabled = false;
    elements.copy.disabled = false;
  } catch (error) {
    currentQr = null;
    elements.content.setAttribute("aria-invalid", "true");
    elements.download.disabled = true;
    elements.copy.disabled = true;
  }
}

function updateExportControls() {
  elements.exportSizes.querySelectorAll("button[data-size]").forEach((button) => {
    const selected = activeSizeMode === "preset" && Number(button.dataset.size) === activeSize;
    button.setAttribute("aria-pressed", String(selected));
  });
  elements.exportFormats.querySelectorAll("button[data-format]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.format === activeFormat));
  });
  if (activeSizeMode === "preset") elements.pixelSize.value = activeSize;
  elements.customSizeControl.classList.toggle("is-active", activeSizeMode === "custom");
  elements.downloadLabel.textContent = `Download ${FORMAT_META[activeFormat].label}`;
}

function createSizeOptions() {
  CUSTOM_SIZES.forEach((size) => {
    const option = document.createElement("option");
    option.value = size;
    option.textContent = `${size} px`;
    elements.pixelSize.append(option);
  });
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create the export file."));
    }, mime, quality);
  });
}

function createRasterBlob(format, size) {
  const canvas = document.createElement("canvas");
  const transparent = format === "png" && elements.transparent.checked;
  drawQRCode(canvas, currentQr, size, transparent);
  return canvasToBlob(canvas, FORMAT_META[format].mime, format === "jpg" ? 0.94 : undefined);
}

function createPngBlobSynchronously(size) {
  const canvas = document.createElement("canvas");
  drawQRCode(canvas, currentQr, size, elements.transparent.checked);
  const dataUrl = canvas.toDataURL("image/png");
  const binary = window.atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: FORMAT_META.png.mime });
}

function createSvgBlob(size) {
  const moduleCount = currentQr.getModuleCount();
  const quietZone = 4;
  const gridSize = moduleCount + quietZone * 2;
  const modules = [];

  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (currentQr.isDark(row, column)) {
        modules.push(`M${column + quietZone} ${row + quietZone}h1v1h-1z`);
      }
    }
  }

  const background = elements.transparent.checked
    ? ""
    : `<path fill=\"#fff\" d=\"M0 0h${gridSize}v${gridSize}H0z\"/>`;
  const svg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${gridSize} ${gridSize}" shape-rendering="crispEdges">`,
    background,
    `<path fill="${activeColor}" d="${modules.join("")}"/>`,
    "</svg>",
  ].join("");

  return new Blob([svg], { type: FORMAT_META.svg.mime });
}

function hexToRgb(hex) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
}

function createPdfBlob(size) {
  const moduleCount = currentQr.getModuleCount();
  const quietZone = 4;
  const gridSize = moduleCount + quietZone * 2;
  const scale = size / gridSize;
  const [red, green, blue] = hexToRgb(activeColor);
  const commands = [];

  if (!elements.transparent.checked) commands.push(`1 1 1 rg 0 0 ${size} ${size} re f`);
  commands.push(`${red.toFixed(4)} ${green.toFixed(4)} ${blue.toFixed(4)} rg`);

  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (!currentQr.isDark(row, column)) continue;
      const x = (column + quietZone) * scale;
      const y = size - (row + quietZone + 1) * scale;
      commands.push(`${x.toFixed(4)} ${y.toFixed(4)} ${scale.toFixed(4)} ${scale.toFixed(4)} re f`);
    }
  }

  const stream = `${commands.join("\n")}\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${size} ${size}] /Resources << >> /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: FORMAT_META.pdf.mime });
}

async function createExportBlob(format = activeFormat, size = activeSize) {
  if (format === "png" || format === "jpg") return createRasterBlob(format, size);
  if (format === "svg") return createSvgBlob(size);
  return createPdfBlob(size);
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function canShareFile(file) {
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;

  try {
    return navigator.canShare({ files: [file] });
  } catch (error) {
    return false;
  }
}

function showExportDialog(mode, blob) {
  const copying = mode === "copy";
  dialogTrigger = document.activeElement;
  elements.exportDialogTitle.textContent = copying ? "Copy QR code" : "Save QR code";
  elements.exportDialogInstruction.textContent = copying
    ? "Touch and hold the image, then choose Copy."
    : "Touch and hold the image, then choose Save to Photos.";
  if (dialogObjectUrl) URL.revokeObjectURL(dialogObjectUrl);
  dialogObjectUrl = URL.createObjectURL(blob);
  elements.exportDialogImage.src = dialogObjectUrl;
  elements.exportDialog.classList.remove("is-hidden");
  elements.exportDialogClose.focus();
}

function closeExportDialog() {
  elements.exportDialog.classList.add("is-hidden");
  elements.exportDialogImage.removeAttribute("src");
  if (dialogObjectUrl) URL.revokeObjectURL(dialogObjectUrl);
  dialogObjectUrl = null;
  if (dialogTrigger instanceof HTMLElement) dialogTrigger.focus();
}

function triggerFileDownload(blob, format = activeFormat) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const meta = FORMAT_META[format];
  link.download = `qr-code-${activeSize}px.${meta.extension}`;
  link.href = objectUrl;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  showToast(`${meta.label} downloaded`);
}

async function downloadQRCode() {
  if (!currentQr) return;

  let blob;
  try {
    blob = await createExportBlob();
  } catch (error) {
    showToast("Export failed. Please try again.");
    return;
  }

  if (!isIOS()) {
    triggerFileDownload(blob);
    return;
  }

  if (typeof File === "undefined") {
    if (activeFormat === "pdf") triggerFileDownload(blob);
    else showExportDialog("save", blob);
    return;
  }

  const meta = FORMAT_META[activeFormat];
  const file = new File([blob], `qr-code-${activeSize}px.${meta.extension}`, { type: meta.mime });

  if (!canShareFile(file)) {
    if (activeFormat === "pdf") triggerFileDownload(blob);
    else showExportDialog("save", blob);
    return;
  }

  try {
    await navigator.share({ files: [file], title: "QR code" });
  } catch (error) {
    if (error.name !== "AbortError") {
      if (activeFormat === "pdf") triggerFileDownload(blob);
      else showExportDialog("save", blob);
    }
  }
}

function copyQRCode() {
  if (!currentQr) return;

  // Build the PNG synchronously so WebKit keeps the clipboard permission tied
  // to the original click or tap.
  const blob = createPngBlobSynchronously(activeSize);
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    showExportDialog("copy", blob);
    return;
  }

  navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
    .then(() => showToast("QR code copied"))
    .catch(() => showExportDialog("copy", blob));
}

elements.content.addEventListener("input", renderQRCode);
elements.color.addEventListener("input", () => setColor(elements.color.value));
elements.hex.addEventListener("input", () => {
  const normalized = normalizeHex(elements.hex.value);
  elements.hex.setAttribute("aria-invalid", String(!normalized));
  if (normalized) setColor(normalized);
});
elements.hex.addEventListener("blur", () => {
  elements.hex.value = activeColor;
  elements.hex.setAttribute("aria-invalid", "false");
});
elements.transparent.addEventListener("change", () => {
  preferredTransparency = elements.transparent.checked;
  renderQRCode();
});
elements.exportSizes.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-size]");
  if (!button) return;
  activeSize = Number(button.dataset.size);
  activeSizeMode = "preset";
  updateExportControls();
});
elements.pixelSize.addEventListener("change", () => {
  activeSize = Number(elements.pixelSize.value);
  activeSizeMode = "custom";
  updateExportControls();
});
elements.exportFormats.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-format]");
  if (!button) return;
  const wasJpg = activeFormat === "jpg";
  activeFormat = button.dataset.format;
  const jpgSelected = activeFormat === "jpg";
  if (jpgSelected && !wasJpg) {
    preferredTransparency = elements.transparent.checked;
    elements.transparent.checked = false;
  } else if (!jpgSelected && wasJpg) {
    elements.transparent.checked = preferredTransparency;
  }
  elements.transparent.disabled = jpgSelected;
  elements.transparentSwitch.classList.toggle("is-disabled", jpgSelected);
  renderQRCode();
  updateExportControls();
});
elements.download.addEventListener("click", downloadQRCode);
elements.copy.addEventListener("click", copyQRCode);
elements.exportDialogClose.addEventListener("click", closeExportDialog);
elements.exportDialog.addEventListener("click", (event) => {
  if (event.target === elements.exportDialog) closeExportDialog();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.exportDialog.classList.contains("is-hidden")) closeExportDialog();
});

createSwatches();
createSizeOptions();
updateExportControls();
renderQRCode();
