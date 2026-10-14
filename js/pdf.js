// pdf.js: turns a layout into a PDF with one page per sheet.

import { GUTTER } from "./layout.js";

const { jsPDF } = window.jspdf;

const MAX_DPI = 300;

export function buildPdf(image, layout) {
    const page = layout.page;
    const doc = new jsPDF({
        unit: 'in',
        format: [page.width, page.height],
        orientation: page.landscape ? 'landscape' : 'portrait',
    });

    for (const sheet of layout.sheets) {
        if (sheet.number > 1) doc.addPage();

        const picture = sliceImage(image, layout, sheet);
        doc.addImage(picture, 'JPEG', page.inset, page.inset, sheet.width, sheet.height);

        drawOverlapLines(doc, layout, sheet);
        drawTrimMarks(doc, layout, sheet);
        drawLabels(doc, layout, sheet);
    }

    return doc;
}

// Copies one sheet's part of the image onto a small canvas and returns it as a JPEG.
function sliceImage(image, layout, sheet) {
    const sourceX = layout.crop.x + sheet.x * layout.dpi;
    const sourceY = layout.crop.y + sheet.y * layout.dpi;
    const sourceWidth = sheet.width * layout.dpi;
    const sourceHeight = sheet.height * layout.dpi;

    // Shrink it if the image has more detail than a printer can use.
    const shrink = Math.min(1, MAX_DPI / layout.dpi);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sourceWidth * shrink);
    canvas.height = Math.round(sourceHeight * shrink);

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // JPEG has no transparency, so see-through areas become white
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.92);
}

// Red dashed lines showing where the next sheet's edges should land
function drawOverlapLines(doc, layout, sheet) {
    const inset = layout.page.inset;
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.01);
    doc.setLineDashPattern([0.08, 0.05], 0);

    if (sheet.col < layout.cols.count - 1) {
        const x = inset + layout.cols.step;
        doc.line(x, inset, x, inset + sheet.height);
    }
    if (sheet.row < layout.rows.count - 1) {
        const y = inset + layout.rows.step;
        doc.line(inset, y, inset + sheet.width, y);
    }

    doc.setLineDashPattern([], 0);
}

// Short ticks at each corner of the picture 
function drawTrimMarks(doc, layout, sheet) {
    const left = layout.page.inset;
    const top = layout.page.inset;
    const right = left + sheet.width;
    const bottom = top + sheet.height;
    const gap = 0.03;
    const length = GUTTER - gap;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.005);

    for (const x of [left, right]) {
        doc.line(x, top - gap, x, top - gap - length);
        doc.line(x, bottom + gap, x, bottom + gap + length);
    }
    for (const y of [top, bottom]) {
        doc.line(left - gap, y, left - gap - length, y);
        doc.line(right + gap, y, right + gap + length, y);
    }
}

// A line of text above the picture saying which sheet this is,
// and one below it saying what to do with it.
function drawLabels(doc, layout, sheet) {
    const inset = layout.page.inset;
    const textX = inset + 0.06;

    const title = `Sheet ${sheet.number} of ${layout.sheets.length}`;
    const place = `row ${sheet.row + 1}, column ${sheet.col + 1}`;
    const paper = `${layout.page.name} ${layout.page.landscape ? 'landscape' : 'portrait'}`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(`${title}  |  ${place}  |  Print at 100% (actual size) on ${paper}`, textX, inset - 0.07);

    // Sheets go down in numerical order, each on top of the last
    const edges = [];
    if (sheet.col > 0) edges.push('LEFT');
    if (sheet.row > 0) edges.push('TOP');

    let steps;
    if (edges.length === 0) {
       steps = 'Lay this sheet down first. No trimming needed.';
    } else {
        steps = `Trim the white border off the ${edges.join(' and ')}, then lay this sheet on the red dashed lines of the sheets before it.`;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 90);
    doc.text(steps, textX, inset + sheet.height + 0.13);
}