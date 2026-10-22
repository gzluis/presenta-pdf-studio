'use strict';

const { PDFDocument } = require('pdf-lib');
const fs = require('node:fs/promises');

/** PDF con una pagina por diapositiva JPG, conservando su proporcion. */
async function savePdf(images, filename, title = 'Presentacion de Genially') {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('No se han capturado diapositivas.');
  }
  const pdf = await PDFDocument.create();
  pdf.setTitle(title.substring(0, 100));
  pdf.setCreator('Presentaciones to PDF (capturas locales)');
  pdf.setSubject('Exportacion visual de una presentacion publica');

  const PAGE_W = 960;
  for (const bytes of images) {
    const embedded = await pdf.embedJpg(bytes);
    const PAGE_H = Math.round(PAGE_W * (embedded.height / embedded.width));
    const pdfPage = pdf.addPage([PAGE_W, PAGE_H]);
    const scale = Math.min(PAGE_W / embedded.width, PAGE_H / embedded.height);
    const w = embedded.width * scale;
    const h = embedded.height * scale;
    pdfPage.drawImage(embedded, {
      x: (PAGE_W - w) / 2,
      y: (PAGE_H - h) / 2,
      width: w,
      height: h
    });
  }
  const content = await pdf.save({ useObjectStreams: true });
  await fs.writeFile(filename, content);
  return content.length;
}

module.exports = { savePdf };
