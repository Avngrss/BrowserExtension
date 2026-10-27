import { createBrowserScreenshotIdb } from '@/src/screenshots/screenshot-idb';

const idb = createBrowserScreenshotIdb();

export async function loadScreenshotBlobUrl(
  storageRef: string,
): Promise<string | null> {
  const blob = await idb.getBlob(storageRef);
  if (blob === null) {
    return null;
  }
  return URL.createObjectURL(blob);
}
