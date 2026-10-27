export const SCREENSHOT_JPEG_QUALITY = 0.85;
export const SCREENSHOT_MAX_WIDTH = 1600;

export async function processScreenshotDataUrl(
  dataUrl: string,
): Promise<{ blob: Blob; width: number; height: number }> {
  const response = await fetch(dataUrl);
  const inputBlob = await response.blob();
  const bitmap = await createImageBitmap(inputBlob);

  try {
    const scale =
      bitmap.width > SCREENSHOT_MAX_WIDTH
        ? SCREENSHOT_MAX_WIDTH / bitmap.width
        : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new Error('Canvas context unavailable.');
    }
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: SCREENSHOT_JPEG_QUALITY,
    });
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}
