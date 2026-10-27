import type {
  ScreenshotFrame,
  ScreenshotIssueLink,
} from '@/src/domain/screenshot-evidence';
import type { ScreenshotIdbAdapter } from '@/src/screenshots/screenshot-idb';

export function createInMemoryScreenshotIdb(): ScreenshotIdbAdapter & {
  corruptBlob(storageRef: string): void;
} {
  const frames = new Map<string, ScreenshotFrame>();
  const links: ScreenshotIssueLink[] = [];
  const blobs = new Map<string, Blob>();
  const blobCorrupted = new Set<string>();

  return {
    putFrame(frame) {
      frames.set(frame.id, frame);
      return Promise.resolve();
    },
    getFrame(id) {
      return Promise.resolve(frames.get(id) ?? null);
    },
    getAllFrames() {
      return Promise.resolve([...frames.values()]);
    },
    deleteFrame(id) {
      frames.delete(id);
      return Promise.resolve();
    },
    clearFrames() {
      frames.clear();
      return Promise.resolve();
    },
    putLink(link) {
      const exists = links.some(
        (item) =>
          item.screenshotId === link.screenshotId &&
          item.issueCategory === link.issueCategory &&
          item.issueId === link.issueId,
      );
      if (!exists) {
        links.push(link);
      }
      return Promise.resolve();
    },
    getAllLinks() {
      return Promise.resolve([...links]);
    },
    deleteLink(screenshotId, issueCategory, issueId) {
      const index = links.findIndex(
        (item) =>
          item.screenshotId === screenshotId &&
          item.issueCategory === issueCategory &&
          item.issueId === issueId,
      );
      if (index >= 0) {
        links.splice(index, 1);
      }
      return Promise.resolve();
    },
    clearLinks() {
      links.length = 0;
      return Promise.resolve();
    },
    putBlob(storageRef, blob) {
      blobCorrupted.delete(storageRef);
      blobs.set(storageRef, blob);
      return Promise.resolve();
    },
    getBlob(storageRef) {
      if (blobCorrupted.has(storageRef)) {
        return Promise.resolve(null);
      }
      return Promise.resolve(blobs.get(storageRef) ?? null);
    },
    deleteBlob(storageRef) {
      blobs.delete(storageRef);
      blobCorrupted.delete(storageRef);
      return Promise.resolve();
    },
    clearBlobs() {
      blobs.clear();
      blobCorrupted.clear();
      return Promise.resolve();
    },
    clearAll() {
      frames.clear();
      links.length = 0;
      blobs.clear();
      blobCorrupted.clear();
      return Promise.resolve();
    },
    corruptBlob(storageRef: string) {
      blobCorrupted.add(storageRef);
    },
  };
}
