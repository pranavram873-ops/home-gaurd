import { compressImage } from '@/lib/services/simpleAttendanceService';
import { createImagePdf } from '@/lib/utils/createImagePdf';

export type PreparedMemoAttachment = {
  photo: string;
  document: string;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not prepare the memo document.'));
    reader.onerror = () => reject(new Error('Could not prepare the memo document.'));
    reader.readAsDataURL(file);
  });
}

/** Produce the thumbnail and one-page PDF used by every personnel report form. */
export async function prepareMemoAttachment(file: File): Promise<PreparedMemoAttachment> {
  const photo = await compressImage(file, 1200, 1200, 0.82);
  const jpeg = await (await fetch(photo)).blob();
  const pdf = await createImagePdf(jpeg);
  return { photo, document: await fileToDataUrl(pdf) };
}
