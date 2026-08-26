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

const elements = {
  content: document.querySelector("#content"),
  size: document.querySelector("#size"),
  sizeValue: document.querySelector("#size-value"),
  color: document.querySelector("#color"),
  hex: document.querySelector("#hex"),
  swatches: document.querySelector("#swatches"),
  transparent: document.querySelector("#transparent"),
  plate: document.querySelector("#plate"),
  preview: document.querySelector("#preview"),
  note: document.querySelector("#note"),
  download: document.querySelector("#download"),
  copy: document.querySelector("#copy"),
  exportDialog: document.querySelector("#export-dialog"),
  exportDialogTitle: document.querySelector("#export-dialog-title"),
  exportDialogInstruction: document.querySelector("#export-dialog-instruction"),
  exportDialogImage: document.querySelector("#export-dialog-image"),
  exportDialogClose: document.querySelector("#export-dialog-close"),
  toast: document.querySelector("#toast"),
};

let activeColor = elements.color.value.toUpperCase();
let toastTimer;
let dialogTrigger;

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

function updateSlider() {
  const minimum = Number(elements.size.min);
  const maximum = Number(elements.size.max);
  const value = Number(elements.size.value);
  const percentage = ((value - minimum) / (maximum - minimum)) * 100;

  elements.sizeValue.textContent = value;
  elements.size.style.setProperty("--pct", `${percentage}%`);
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

function drawQRCode(qr, size) {
  const context = elements.preview.getContext("2d");
  const moduleCount = qr.getModuleCount();
  const quietZone = 4;
  const gridSize = moduleCount + quietZone * 2;

  elements.preview.width = size;
  elements.preview.height = size;
  elements.preview.style.width = `${size}px`;
  elements.preview.style.height = `${size}px`;

  context.clearRect(0, 0, size, size);
  if (!elements.transparent.checked) {
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

function showNote(message, isError = false) {
  elements.note.textContent = message;
  elements.note.classList.toggle("is-hidden", !message);
  elements.note.classList.toggle("is-error", isError);
}

function renderQRCode() {
  const content = elements.content.value;
  const size = Number(elements.size.value);

  updateSlider();
  elements.plate.classList.toggle("is-transparent", elements.transparent.checked);

  if (!content.trim()) {
    const context = elements.preview.getContext("2d");
    context.clearRect(0, 0, elements.preview.width, elements.preview.height);
    showNote("Enter a URL or text to generate a QR code.", true);
    elements.download.disabled = true;
    elements.copy.disabled = true;
    return;
  }

  if (typeof qrcode !== "function") {
    showNote("The QR code library could not be loaded. Refresh and try again.", true);
    elements.download.disabled = true;
    elements.copy.disabled = true;
    return;
  }

  try {
    const qr = qrcode(0, "M");
    qr.addData(content);
    qr.make();
    drawQRCode(qr, size);

    elements.download.disabled = false;
    elements.copy.disabled = false;
    showNote(size > 320 ? `Preview cropped to 320px · PNG exports at ${size}px` : "");
  } catch (error) {
    showNote("This content is too long to encode as a QR code.", true);
    elements.download.disabled = true;
    elements.copy.disabled = true;
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
}

function createPngBlob() {
  const dataUrl = elements.preview.toDataURL("image/png");
  const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: "image/png" });
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

function showExportDialog(mode) {
  const copying = mode === "copy";
  dialogTrigger = document.activeElement;
  elements.exportDialogTitle.textContent = copying ? "Copy QR code" : "Save QR code";
  elements.exportDialogInstruction.textContent = copying
    ? "Touch and hold the image, then choose Copy."
    : "Touch and hold the image, then choose Save to Photos.";
  elements.exportDialogImage.src = elements.preview.toDataURL("image/png");
  elements.exportDialog.classList.remove("is-hidden");
  elements.exportDialogClose.focus();
}

function closeExportDialog() {
  elements.exportDialog.classList.add("is-hidden");
  elements.exportDialogImage.removeAttribute("src");
  if (dialogTrigger instanceof HTMLElement) dialogTrigger.focus();
}

function triggerFileDownload(blob) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = "qr-code.png";
  link.href = objectUrl;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  showToast("PNG downloaded");
}

async function downloadQRCode() {
  const blob = createPngBlob();

  if (!isIOS()) {
    triggerFileDownload(blob);
    return;
  }

  if (typeof File === "undefined") {
    showExportDialog("save");
    return;
  }

  const file = new File([blob], "qr-code.png", { type: "image/png" });

  if (!canShareFile(file)) {
    showExportDialog("save");
    return;
  }

  try {
    await navigator.share({ files: [file], title: "QR code" });
  } catch (error) {
    if (error.name !== "AbortError") showExportDialog("save");
  }
}

function copyQRCode() {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    showExportDialog("copy");
    return;
  }

  // WebKit requires clipboard.write() to start during the tap handler. Build
  // the PNG synchronously and pass a settled promise to preserve that gesture.
  const png = Promise.resolve(createPngBlob());
  navigator.clipboard.write([new ClipboardItem({ "image/png": png })])
    .then(() => showToast("QR code copied"))
    .catch(() => showExportDialog("copy"));
}

elements.content.addEventListener("input", renderQRCode);
elements.size.addEventListener("input", renderQRCode);
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
elements.transparent.addEventListener("change", renderQRCode);
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
renderQRCode();
