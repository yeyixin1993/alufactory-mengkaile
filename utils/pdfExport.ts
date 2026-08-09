export interface PdfExportOptions {
  returnBase64?: boolean;
  skipSave?: boolean;
}

const PDF_BLOCK_SELECTOR = '[data-pdf-block]';
const KEEP_TOGETHER_SELECTOR = '[data-pdf-keep-together], .break-inside-avoid, tr, img, svg';

const nextFrame = () => new Promise<void>((resolve) => {
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
});

const waitForImage = async (image: HTMLImageElement) => {
  if (image.complete) {
    try {
      await image.decode?.();
    } catch {
      // A failed optional image should not block the complete order export.
    }
    return;
  }

  await new Promise<void>((resolve) => {
    const finish = () => resolve();
    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', finish, { once: true });
    window.setTimeout(finish, 10_000);
  });
};

const waitForAssets = async (element: HTMLElement) => {
  if ('fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue with the browser fallback font if font readiness is unavailable.
    }
  }
  await Promise.all(Array.from(element.querySelectorAll('img')).map(waitForImage));
  await nextFrame();
};

const makeElementCaptureable = async (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  const isFarOutsideViewport = rect.bottom < 0 || rect.right < 0 || rect.top < -window.innerHeight;
  if (!isFarOutsideViewport) return () => {};

  const host = element.parentElement;
  if (!host) return () => {};
  const originalStyle = host.getAttribute('style');
  Object.assign(host.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: `${Math.max(element.scrollWidth, 794)}px`,
    height: 'auto',
    maxHeight: 'none',
    overflow: 'visible',
    opacity: '1',
    visibility: 'visible',
    pointerEvents: 'none',
    zIndex: '2147483000',
    background: '#ffffff',
  });
  await nextFrame();

  return () => {
    if (originalStyle === null) host.removeAttribute('style');
    else host.setAttribute('style', originalStyle);
  };
};

const findExportBlocks = (element: HTMLElement): HTMLElement[] => {
  const explicit = Array.from(element.querySelectorAll<HTMLElement>(PDF_BLOCK_SELECTOR));
  if (explicit.length === 0) return [element];
  // Nested markers describe protected content inside a larger block. Only the
  // outermost marked elements are separate PDF layout blocks.
  return explicit.filter((candidate) => {
    const parentBlock = candidate.parentElement?.closest(PDF_BLOCK_SELECTOR);
    return !parentBlock || !element.contains(parentBlock);
  });
};

type Html2Canvas = typeof import('html2canvas')['default'];

const captureBlock = async (element: HTMLElement, html2canvas: Html2Canvas) => html2canvas(element, {
  // 1.5x remains sharp for A4 text/QR codes while avoiding the memory and
  // multi-minute render cost of dozens of separate 2x production cards.
  scale: 1.5,
  useCORS: true,
  allowTaint: false,
  logging: false,
  backgroundColor: '#ffffff',
  imageTimeout: 10_000,
  scrollX: 0,
  scrollY: -window.scrollY,
  windowWidth: Math.max(document.documentElement.clientWidth, element.scrollWidth),
});

const getProtectedRanges = (element: HTMLElement, canvas: HTMLCanvasElement) => {
  const rootRect = element.getBoundingClientRect();
  if (rootRect.height <= 0) return [];
  const canvasRatio = canvas.height / rootRect.height;

  return Array.from(element.querySelectorAll<HTMLElement>(KEEP_TOGETHER_SELECTOR))
    .map((child) => {
      const rect = child.getBoundingClientRect();
      return {
        start: Math.max(0, Math.floor((rect.top - rootRect.top) * canvasRatio)),
        end: Math.min(canvas.height, Math.ceil((rect.bottom - rootRect.top) * canvasRatio)),
      };
    })
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);
};

const chooseSafeSliceEnd = (
  start: number,
  idealEnd: number,
  canvasHeight: number,
  protectedRanges: Array<{ start: number; end: number }>,
) => {
  if (idealEnd >= canvasHeight) return canvasHeight;
  const minimumUsefulSlice = Math.max(80, Math.floor((idealEnd - start) * 0.2));
  let end = idealEnd;

  protectedRanges.forEach((range) => {
    if (range.start < end && range.end > end && range.start - start >= minimumUsefulSlice) {
      end = Math.min(end, range.start);
    }
  });

  return Math.max(start + 1, end);
};

const sliceCanvas = (source: HTMLCanvasElement, startY: number, endY: number) => {
  const height = Math.max(1, endY - startY);
  const slice = document.createElement('canvas');
  slice.width = source.width;
  slice.height = height;
  const context = slice.getContext('2d');
  if (!context) throw new Error('Unable to create PDF page canvas.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, slice.width, slice.height);
  context.drawImage(source, 0, startY, source.width, height, 0, 0, source.width, height);
  return slice;
};

const canvasHasVisibleContent = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return false;
  const stepX = Math.max(1, Math.floor(canvas.width / 80));
  const stepY = Math.max(1, Math.floor(canvas.height / 100));
  try {
    for (let y = 0; y < canvas.height; y += stepY) {
      for (let x = 0; x < canvas.width; x += stepX) {
        const [red, green, blue, alpha] = context.getImageData(x, y, 1, 1).data;
        if (alpha > 0 && (red < 245 || green < 245 || blue < 245)) return true;
      }
    }
  } catch {
    // A tainted canvas still contains rendered external image content.
    return true;
  }
  return false;
};

export const exportElementToPdf = async (
  element: HTMLElement | null,
  filename: string,
  options?: PdfExportOptions,
) => {
  if (!element) throw new Error('PDF export element is unavailable.');

  // These libraries are only needed after an explicit export request. Loading
  // them here keeps the storefront's first JavaScript bundle much smaller.
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const restorePosition = await makeElementCaptureable(element);
  try {
    await waitForAssets(element);

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const marginMm = 8;
    const blockGapMm = 4;
    const contentWidthMm = pdfWidth - marginMm * 2;
    const printableHeightMm = pdfHeight - marginMm * 2;
    const blocks = findExportBlocks(element);
    let currentY = marginMm;
    let pageHasContent = false;
    let hasVisibleContent = false;

    const addPage = () => {
      pdf.addPage();
      currentY = marginMm;
      pageHasContent = false;
    };

    for (const block of blocks) {
      const canvas = await captureBlock(block, html2canvas);
      if (canvas.width <= 0 || canvas.height <= 0) continue;
      hasVisibleContent = hasVisibleContent || canvasHasVisibleContent(canvas);

      const mmPerPixel = contentWidthMm / canvas.width;
      const fullHeightMm = canvas.height * mmPerPixel;

      if (fullHeightMm <= printableHeightMm) {
        if (pageHasContent && currentY + fullHeightMm > pdfHeight - marginMm) addPage();
        pdf.addImage(canvas, 'JPEG', marginMm, currentY, contentWidthMm, fullHeightMm, undefined, 'FAST');
        currentY += fullHeightMm + blockGapMm;
        pageHasContent = true;
        continue;
      }

      // Oversized machining cards are split independently. Safe DOM ranges
      // keep rows, images, SVG diagrams, and marked sections on one page.
      if (pageHasContent) addPage();
      const protectedRanges = getProtectedRanges(block, canvas);
      const maxSlicePixels = Math.max(1, Math.floor(printableHeightMm / mmPerPixel));
      let sourceY = 0;
      let lastSliceHeightMm = 0;
      while (sourceY < canvas.height) {
        const idealEnd = Math.min(canvas.height, sourceY + maxSlicePixels);
        const endY = chooseSafeSliceEnd(sourceY, idealEnd, canvas.height, protectedRanges);
        const pageCanvas = sliceCanvas(canvas, sourceY, endY);
        const pageHeightMm = pageCanvas.height * mmPerPixel;
        lastSliceHeightMm = pageHeightMm;
        pdf.addImage(pageCanvas, 'JPEG', marginMm, marginMm, contentWidthMm, pageHeightMm, undefined, 'FAST');
        pageHasContent = true;
        sourceY = endY;
        if (sourceY < canvas.height) addPage();
      }
      currentY = marginMm + lastSliceHeightMm + blockGapMm;
    }

    if (!pageHasContent || !hasVisibleContent) throw new Error('PDF export produced no visible content.');

    if (!options?.skipSave) pdf.save(filename);
    if (options?.returnBase64) return pdf.output('datauristring').split(',')[1];
    return undefined;
  } finally {
    restorePosition();
  }
};
