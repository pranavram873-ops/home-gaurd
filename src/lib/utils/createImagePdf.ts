/** Wrap a JPEG image as a single-page PDF without uploading it to a service. */
export async function createImagePdf(jpeg: Blob): Promise<File> {
  if (jpeg.type !== 'image/jpeg') throw new Error('The scanned page must be a JPEG image.');

  const bitmap = await createImageBitmap(jpeg);
  try {
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const scale = Math.min(pageWidth / bitmap.width, pageHeight / bitmap.height);
    const drawWidth = bitmap.width * scale;
    const drawHeight = bitmap.height * scale;
    const drawX = (pageWidth - drawWidth) / 2;
    const drawY = (pageHeight - drawHeight) / 2;
    const jpegBytes = new Uint8Array(await jpeg.arrayBuffer());
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    let length = 0;
    const append = (chunk: Uint8Array) => { chunks.push(chunk); length += chunk.length; };
    const ascii = (value: string) => encoder.encode(value);
    append(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

    const offsets: number[] = [0];
    const addObject = (id: number, body: Uint8Array[]) => {
      offsets[id] = length;
      append(ascii(`${id} 0 obj\n`));
      body.forEach(append);
      append(ascii('\nendobj\n'));
    };
    addObject(1, [ascii('<< /Type /Catalog /Pages 2 0 R >>')]);
    addObject(2, [ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')]);
    addObject(3, [ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Memo 4 0 R >> >> /Contents 5 0 R >>`)]);
    addObject(4, [
      ascii(`<< /Type /XObject /Subtype /Image /Width ${bitmap.width} /Height ${bitmap.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`),
      jpegBytes,
      ascii('\nendstream'),
    ]);
    const content = ascii(`q\n${drawWidth} 0 0 ${drawHeight} ${drawX} ${drawY} cm\n/Memo Do\nQ`);
    addObject(5, [ascii(`<< /Length ${content.length} >>\nstream\n`), content, ascii('\nendstream')]);

    const xrefOffset = length;
    append(ascii('xref\n0 6\n0000000000 65535 f \n'));
    for (let id = 1; id <= 5; id += 1) append(ascii(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`));
    append(ascii(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));

    const pdfBytes = new Uint8Array(length);
    let cursor = 0;
    for (const chunk of chunks) {
      pdfBytes.set(chunk, cursor);
      cursor += chunk.length;
    }
    return new File([pdfBytes], 'home-guard-memo.pdf', { type: 'application/pdf' });
  } finally {
    bitmap.close();
  }
}
