// preview.js: paints the on-screen preview and lets the crop be dragged.

const MAX_HEIGHT = 560;


export function drawPreview(canvas, image, layout) {
    // Shrink the whole image to fit the space the canvas fits in
    const available = canvas.parentElement.clientWidth;
    const scale = Math.min(available / image.naturalWidth, MAX_HEIGHT / image.naturalHeight);
    const width = Math.round(image.naturalWidth * scale);
    const height = Math.round(image.naturalHeight * scale);

    // Sharp screens pack several real pixels into each CSS pixel
    // Give the canvas that many, then scale so we can keep drawing in CSS pixels.
    const density = window.devicePixelRatio || 1;
    canvas.width = width * density;
    canvas.height = height * density;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(density, 0, 0, density, 0, 0);
    ctx.drawImage(image, 0, 0, width, height);

    canvas.classList.toggle('is-draggable', Boolean(layout) && layout.croppedFraction > 0.005);
    if (!layout) return;

    const crop = {
        x: layout.crop.x * scale,
        y: layout.crop.y * scale,
        width: layout.crop.width * scale,
        height: layout.crop.height * scale,
    };

    // Darken everything outside of the crop
    ctx.fillStyle = 'rgba(17, 24, 39, 0.65)';
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.rect(crop.x, crop.y, crop.width, crop.height);
    ctx.fill('evenodd');

    const pxPerInch = crop.width / layout.poster.width;

    for (const sheet of layout.sheets) {
        const x = crop.x + sheet.x * pxPerInch;
        const y = crop.y + sheet.y * pxPerInch;
        const w = sheet.width * pxPerInch;
        const h = sheet.height * pxPerInch;

        // A see-through tint: where sheets overlap
        ctx.fillStyle = 'rgba(37, 99, 235, 0.15)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }

    // Numbers go on last so no sheet's tint covers them
    for (const sheet of layout.sheets) {
        const centerX = crop.x + (sheet.x + sheet.width / 2) * pxPerInch;
        const centerY = crop.y + (sheet.y + sheet.height / 2) * pxPerInch;
        const smallerSide = Math.min(sheet.width, sheet.height) * pxPerInch;
        const radius = Math.max(6, Math.min(14, smallerSide * 0.2));

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1f2933';
        ctx.font = `600 ${Math.round(radius * 1.1)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(sheet.number), centerX, centerY);
    }
}

function clamp(value) {
    return Math.min(1, Math.max(0, value));
}

// Dragging on the canvas slides the crop
export function setupDrag(canvas, state, onChange) {
    let start = null;

    canvas.addEventListener('pointerdown', (event) => {
        if (!state.layout) return;
        start = {
        x: event.clientX,
        y: event.clientY,
        offsetX: state.offsetX,
        offsetY: state.offsetY,
        };
        canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener('pointermove', (event) => {
        if (!start) return;

        // "Slack" is how far the crop can travel, in canvas pixels.
        const scale = canvas.clientWidth / state.image.naturalWidth;
        const slackX = (state.image.naturalWidth - state.layout.crop.width) * scale;
        const slackY = (state.image.naturalHeight - state.layout.crop.height) * scale;

        if (slackX > 1) {
        state.offsetX = clamp(start.offsetX + (event.clientX - start.x) / slackX);
        }
        if (slackY > 1) {
        state.offsetY = clamp(start.offsetY + (event.clientY - start.y) / slackY);
        }
        onChange();
    });

    const stop = () => {
        start = null;
    };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
}