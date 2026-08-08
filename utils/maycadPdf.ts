import type { MaycadPdfAiPayload } from './maycadImport';

const viewPagePattern = /多角度视图|立体装配图|multi.?view|isometric|exploded/i;

export const extractMaycadPdfPayload = async (file: File): Promise<MaycadPdfAiPayload> => {
  const [{ getDocument, GlobalWorkerOptions }, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;
  const pageTexts: string[] = [];
  const viewPageNumbers: number[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => String(item.str || '')).join(' ');
    pageTexts.push(text);
    if (viewPagePattern.test(text)) viewPageNumbers.push(pageNumber);
  }

  const selectedPages = Array.from(new Set([
    ...viewPageNumbers.slice(0, 3),
    Math.min(pdf.numPages, 4),
    Math.min(pdf.numPages, 5),
  ])).filter((pageNumber) => pageNumber >= 1).slice(0, 3);

  const viewImages: string[] = [];
  for (const pageNumber of selectedPages) {
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1600 / Math.max(baseViewport.width, baseViewport.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) continue;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    viewImages.push(canvas.toDataURL('image/jpeg', 0.82));
  }

  return {
    filename: file.name,
    extractedText: pageTexts.join('\n\n--- PAGE ---\n\n').slice(0, 60_000),
    viewImages,
  };
};
