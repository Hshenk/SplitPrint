// layout.js: the measuring and arithmetic. No page elements, no drawing.

export const PAPER_SIZES = {
  letter: { name: 'Letter', width: 8.5, height: 11 },
  legal: { name: 'Legal', width: 8.5, height: 14 },
  tabloid: { name: 'Tabloid', width: 11, height: 17 },
  a4: { name: 'A4', width: 8.27, height: 11.69 },
  a3: { name: 'A3', width: 11.69, height: 16.54 },
};

// A strip just inside the printer margin, kept clear for the sheet label and trim marks.
export const GUTTER = 0.2;

const MAX_SHEETS = 200;

const TOLERANCE = 1e-6;


// The two poster sizes that match the image's shape exactly:
// one keeps the width that was asked for, the other keeps the height.
export function fitSizes(imageWidthPx, imageHeightPx, width, height) {
    const imageRatio = imageWidthPx / imageHeightPx;
    return {
        keepWidth: { width, height: width / imageRatio },
        keepHeight: { width: height * imageRatio, height },
    };
}

// The part of the image that survives when it is cropped to the poster's shape.
// offsetX and offsetY run from 0 to 1 and slide the crop across the spare room.
export function cropRect(imageWidthPx, imageHeightPx, width, height, offsetX, offsetY) {
    const imageRatio = imageWidthPx / imageHeightPx;
    const posterRatio = width / height;

    let cropWidth = imageWidthPx;
    let cropHeight = imageHeightPx;
    if (imageRatio > posterRatio) {
        cropWidth = imageHeightPx * posterRatio; // too wide
    } else {
        cropHeight = imageWidthPx / posterRatio; // too tall
    }

    return {
        x: (imageWidthPx - cropWidth) * offsetX,
        y: (imageHeightPx - cropHeight) * offsetY,
        width: cropWidth,
        height: cropHeight,
    };
}

// Covers one direction of the poster (its width or its height) with sheets.
// `length` is the poster's size in that direction, `tile` is how much one sheet can show.
function spreadTiles(length, tile, minOverlap) {
    if (length <= tile + TOLERANCE) {
        return { count: 1, size: length, step: 0, overlap: 0 };
    }
    const count = Math.ceil((length - TOLERANCE - minOverlap) / (tile - minOverlap));
    const step = (length - tile) / (count - 1);
    return { count, size: tile, step, overlap: tile - step };
}

// Works out the grid of sheets for one way round of the paper.
function planForPage(poster, pageWidth, pageHeight, inset, minOverlap) {
    const tileWidth = pageWidth - 2 * inset;
    const tileHeight = pageHeight - 2 * inset;
    if (tileWidth <= minOverlap || tileHeight <= minOverlap) return null;

    const cols = spreadTiles(poster.width, tileWidth, minOverlap);
    const rows = spreadTiles(poster.height, tileHeight, minOverlap);
    return { pageWidth, pageHeight, cols, rows, sheetCount: cols.count * rows.count };
}

function isPositive(value) {
    return Number.isFinite(value) && value > 0;
}

function isZeroOrMore(value) {
    return Number.isFinite(value) && value >= 0;
}

// The main entry point. Takes every setting and returns the full plan,
// or { error: '...' } when the settings can't work.
export function computeLayout(settings) {
    const { imageWidthPx, imageHeightPx, width, height, margin, overlap } = settings;

    if (!isPositive(width) || !isPositive(height)) {
        return { error: 'Enter a width and height greater than zero.' };
    }
    if (!isZeroOrMore(margin) || !isZeroOrMore(overlap)) {
        return { error: 'Margin and overlap must be zero or more.' };
    }

    const poster = { width, height };
    const paper = PAPER_SIZES[settings.paper];
    const inset = margin + GUTTER;

    const portrait = planForPage(poster, paper.width, paper.height, inset, overlap)
    const landscape = planForPage(poster, paper.height, paper.width, inset, overlap);

    if (!portrait || !landscape) {
        return { error: 'The margin and overlap leave no room for the image on this paper.' };
    }

    let plan;
    if (settings.orientation === 'portrait') {
        plan = portrait;
    } else if (settings.orientation === 'landscape') {
        plan = landscape;
    } else if (portrait.sheetCount !== landscape.sheetCount) {
        plan = portrait.sheetCount < landscape.sheetCount ? portrait : landscape;
    } else {
        plan = width > height ? landscape : portrait;
    }

    if (plan.sheetCount > MAX_SHEETS) {
        return { error: `That would take ${plan.sheetCount} sheets. Try a smaller size or bigger paper.` };
    }

    const sheets = [];
    for (let row = 0; row < plan.rows.count; row++) {
        for (let col = 0; col < plan.cols.count; col++) {
            sheets.push({
                number: sheets.length + 1,
                row,
                col,
                x: col * plan.cols.step,
                y: row * plan.rows.step,
                width: plan.cols.size,
                height: plan.rows.size,
            });
        }
    }

    const crop = cropRect(imageWidthPx, imageHeightPx, width, height, settings.offsetX, settings.offsetY);

    return {
        poster,
        crop,
        croppedFraction: 1 - (crop.width * crop.height) / (imageWidthPx * imageHeightPx),
        dpi: crop.width / width,
        page: {
            name: paper.name,
            width: plan.pageWidth,
            height: plan.pageHeight,
            landscape: plan.pageWidth > plan.pageHeight,
            inset,
        },
        cols: plan.cols,
        rows: plan.rows,
        sheets,
    };
}