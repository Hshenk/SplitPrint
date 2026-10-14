// main.js: reads the form, remembers what's loaded
import { computeLayout, fitSizes } from "./layout.js";
import { drawPreview, setupDrag } from "./preview.js";
import { buildPdf } from './pdf.js';

const form = document.getElementById('settings');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');

const widthInput = document.getElementById('width');
const heightInput = document.getElementById('height');
const paperSelect = document.getElementById('paper');
const orientationSelect = document.getElementById('orientation');
const marginInput = document.getElementById('margin');
const overlapInput = document.getElementById('overlap');

const ratioNotice = document.getElementById('ratio-notice');
const ratioText = document.getElementById('ratio-text');
const fitWidthButton = document.getElementById('fit-width');
const fitHeightButton = document.getElementById('fit-height');

const summary = document.getElementById('summary');
const sumSheets = document.getElementById('sum-sheets');
const sumPaper = document.getElementById('sum-paper');
const sumOverlap = document.getElementById('sum-overlap');
const sumDpi = document.getElementById('sum-dpi');
const warningBox = document.getElementById('warning');
const errorBox = document.getElementById('error');
const downloadButton = document.getElementById('download');

const previewEmpty = document.getElementById('preview-empty');
const previewStage = document.getElementById('preview-stage');
const previewCanvas = document.getElementById('preview');
const legend = document.getElementById('legend');


const state = {
    image: null, // The loaded picture
    fileName: '',
    offsetX: 0.5,
    offsetY: 0.5,
    layout: null,
};

// Helpers
function tidy(number) {
    return String(Math.round(number * 100) / 100);
}

function showMessage(box, text) {
    box.textContent = text || '';
    box.hidden = !text;
}

// ---------- Loading an image ----------
async function loadFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showMessage(errorBox, 'That file is not supported. Try a PNG or JPG');
        return;
    }

    const image = new Image();
    image.src = URL.createObjectURL(file);
    try {
        await image.decode();
    } catch {
        showMessage(errorBox, 'That image could not be opened');
        return;
    }

    state.image = image;
    state.fileName = file.name;
    state.offsetX = 0.5;
    state.offsetY = 0.5;

    showMessage(fileInfo, `${file.name} (${image.naturalWidth} \u00D7 ${image.naturalHeight} px)`);
    previewEmpty.hidden = true;
    previewStage.hidden = false;
    legend.hidden = false;
    update();
}

// Drag and drop image
fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

window.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('is-dragging');
});

window.addEventListener('dragleave', () => {
  dropZone.classList.remove('is-dragging');
});

window.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('is-dragging');
  loadFile(event.dataTransfer.files[0]);
});

// ---------- Reading the form ----------

function readSettings() {
    return {
        imageWidthPx: state.image.naturalWidth,
        imageHeightPx: state.image.naturalHeight,
        width: parseFloat(widthInput.value),
        height: parseFloat(heightInput.value),
        paper: paperSelect.value,
        orientation: orientationSelect.value,
        margin: parseFloat(marginInput.value),
        overlap: parseFloat(overlapInput.value),
        offsetX: state.offsetX,
        offsetY: state.offsetY,
    };
}

// ---------- Showing the results ----------

function showSummary(layout) {
    summary.hidden = !layout;
    if (!layout) {
        showMessage(warningBox, '');
        return;
    }

    const count = layout.sheets.length;
    sumSheets.textContent = `${count} (${layout.cols.count} across \u00D7 ${layout.rows.count} down)`;
    sumPaper.textContent = `${layout.page.name}, ${layout.page.landscape ? 'landscape' : 'portrait'}`;
    sumDpi.textContent = `${Math.round(layout.dpi)} pixels per inch`;

    if (count === 1) {
        sumOverlap.textContent = 'None (one sheet)';
    } else {
        const parts = [];
        if (layout.cols.count > 1) parts.push(`${tidy(layout.cols.overlap)} in across`);
        if (layout.rows.count > 1) parts.push(`${tidy(layout.rows.overlap)} in down`);
        sumOverlap.textContent = parts.join(', ');
    }

    if (layout.dpi < 100) {
        showMessage(warningBox, `This image only has ${Math.round(layout.dpi)} pixels for each printed inch, so it will look blurry up close. 150 or more looks sharp.`);
    } else {
        showMessage(warningBox, '');
    }
}

function showRatioNotice(layout) {
    // Under half a percent lost counts as a match
    if (!layout || layout.croppedFraction < 0.005) {
        ratioNotice.hidden = true;
        return;
    }

    const percent = Math.max(1, Math.round(layout.croppedFraction * 100));
    const where = layout.crop.width < state.image.naturalWidth ? 'the sides' : 'the top and bottom';
    ratioText.textContent = `The image is a different shape from this size, so ${percent}% of it will be cropped off ${where}. Drag the preview to choose which part. To keep the whole image, use one of these sizes instead:`;

    const fits = fitSizes(state.image.naturalWidth, state.image.naturalHeight, layout.poster.width, layout.poster.height);
    fitWidthButton.textContent = `${tidy(fits.keepWidth.width)} \u00D7 ${tidy(fits.keepWidth.height)} in`;
    fitHeightButton.textContent = `${tidy(fits.keepHeight.width)} \u00D7 ${tidy(fits.keepHeight.height)} in`;
    ratioNotice.hidden = false;
}

function update() {
    if (!state.image) return;

    const result = computeLayout(readSettings());
    state.layout = result.error ? null : result;

    showMessage(errorBox, result.error);
    downloadButton.disabled = !state.layout;
    showSummary(state.layout);
    showRatioNotice(state.layout);
    drawPreview(previewCanvas, state.image, state.layout);
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());

// ---------- The "keep the whole image" buttons ----------
function useFit(which) {
    const fits = fitSizes(state.image.naturalWidth, state.image.naturalHeight, state.layout.poster.width, state.layout.poster.height);
    widthInput.value = tidy(fits[which].width);
    heightInput.value = tidy(fits[which].height);
    update();
}

fitWidthButton.addEventListener('click', () => useFit('keepWidth'));
fitHeightButton.addEventListener('click', () => useFit('keepHeight'));

// ---------- Keeping the preview live ----------
setupDrag(previewCanvas, state, update);
window.addEventListener('resize', update);

// ---------- Downloading the PDF ----------
downloadButton.addEventListener('click', async () => {
    downloadButton.disabled = true;
    downloadButton.textContent = 'Building PDF...';
    // Building can take a few seconds. Pause briefly first so the button's new text gets painted.
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
        const doc = buildPdf(state.image, state.layout);
        const baseName = state.fileName.replace(/\.[^.]+$/, ''); // drop the file extension
        doc.save(`${baseName}-splitprint.pdf`);
    } catch (error) {
        console.error(error);
        showMessage(errorBox, 'Something went wrong while building the PDF.');
    } finally {
        downloadButton.textContent = 'Download PDF';
        downloadButton.disabled = false;
    }
});