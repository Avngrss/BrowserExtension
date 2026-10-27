import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScreenshotFrame } from '@/src/domain/screenshot-evidence';
import { ScreenshotEvidenceStore } from '@/src/screenshots/screenshot-evidence-store';
import {
  SCREENSHOT_IDB_NAME,
  SCREENSHOT_IDB_VERSION,
  SCREENSHOT_METADATA_STORE,
  createBrowserScreenshotIdb,
  deleteScreenshotDatabaseForTests,
  resetScreenshotIdbConnectionForTests,
  runLegacyMetadataMigration,
} from '@/src/screenshots/screenshot-idb';
async function seedLegacyMetadataDatabase(
  records: Array<Record<string, unknown>>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(SCREENSHOT_IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SCREENSHOT_METADATA_STORE)) {
        db.createObjectStore(SCREENSHOT_METADATA_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(SCREENSHOT_METADATA_STORE, 'readwrite');
      const store = tx.objectStore(SCREENSHOT_METADATA_STORE);
      for (const record of records) {
        store.put(record);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        reject(tx.error ?? new Error('legacy seed failed'));
      };
    };
    request.onerror = () => {
      reject(request.error ?? new Error('legacy open failed'));
    };
  });
}

describe('screenshot IndexedDB', () => {
  afterEach(async () => {
    resetScreenshotIdbConnectionForTests();
    await deleteScreenshotDatabaseForTests();
  });

  it('migrates legacy metadata without deleting the store before the cursor finishes', async () => {
    await seedLegacyMetadataDatabase([
      {
        id: 'shot-legacy',
        sessionId: 'session-legacy',
        issueCategory: 'ui',
        issueId: 'ui-1',
        capturedAt: 1,
        pageUrl: 'https://example.com',
        width: 10,
        height: 10,
        format: 'jpeg',
        storageRef: 'shot-legacy',
        status: 'captured',
      },
    ]);

    const idb = createBrowserScreenshotIdb();
    const frames = await idb.getAllFrames();
    const links = await idb.getAllLinks();

    expect(frames).toHaveLength(1);
    expect(frames[0]?.id).toBe('shot-legacy');
    expect(links).toHaveLength(1);
    expect(links[0]?.issueId).toBe('ui-1');

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(
        SCREENSHOT_IDB_NAME,
        SCREENSHOT_IDB_VERSION,
      );
      request.onsuccess = () => {
        const db = request.result;
        expect(db.objectStoreNames.contains(SCREENSHOT_METADATA_STORE)).toBe(
          false,
        );
        db.close();
        resolve();
      };
      request.onerror = () => {
        reject(request.error ?? new Error('open failed'));
      };
    });
  });

  it('deletes the legacy metadata store only after the migration cursor completes', async () => {
    const deleteSpy = vi.fn();
    const upgradeTx = {
      objectStore: vi.fn(() => ({
        openCursor: vi.fn(() => {
          let step = 0;
          const request = {
            onsuccess: null as
              | ((event: {
                  target: {
                    result: { value: unknown; continue: () => void } | null;
                  };
                }) => void)
              | null,
            onerror: null as (() => void) | null,
          };
          queueMicrotask(() => {
            if (request.onsuccess === null) {
              return;
            }
            if (step === 0) {
              step += 1;
              request.onsuccess({
                target: {
                  result: {
                    value: {
                      id: 'legacy-1',
                      sessionId: 's1',
                      capturedAt: 1,
                      pageUrl: null,
                      width: 1,
                      height: 1,
                      format: 'jpeg',
                      storageRef: 'legacy-1',
                      status: 'captured',
                    },
                    continue: () => {
                      queueMicrotask(() => {
                        request.onsuccess?.({
                          target: { result: null },
                        });
                      });
                    },
                  },
                },
              });
              return;
            }
          });
          return request;
        }),
        put: vi.fn(),
      })),
      abort: vi.fn(),
    } as unknown as IDBTransaction;

    const db = {
      objectStoreNames: { contains: () => true },
      deleteObjectStore: deleteSpy,
    } as unknown as IDBDatabase;

    runLegacyMetadataMigration(upgradeTx, db);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith(SCREENSHOT_METADATA_STORE);
  });

  it('serializes clearSession with screenshot finalization writes', async () => {
    const idb = createBrowserScreenshotIdb();
    const store = new ScreenshotEvidenceStore(idb);
    await store.waitUntilReady();

    const frame: ScreenshotFrame = {
      id: 'frame-race',
      sessionId: 'session-idb',
      capturedAt: Date.now(),
      pageUrl: 'https://example.com',
      width: 1,
      height: 1,
      format: 'jpeg',
      storageRef: 'frame-race',
      status: 'captured',
    };

    await Promise.all([
      store.upsertFrame(frame),
      store.clearSession(),
      store.upsertFrame({ ...frame, id: 'frame-after-clear' }),
    ]);

    const frames = await idb.getAllFrames();
    expect(frames.some((item) => item.id === 'frame-race')).toBe(false);
    expect(frames.some((item) => item.id === 'frame-after-clear')).toBe(true);
  });

  it('writes immediately after a version upgrade', async () => {
    await seedLegacyMetadataDatabase([
      {
        id: 'legacy-immediate',
        sessionId: 'session-idb',
        capturedAt: 1,
        pageUrl: null,
        width: 1,
        height: 1,
        format: 'jpeg',
        storageRef: 'legacy-immediate',
        status: 'captured',
      },
    ]);

    const idb = createBrowserScreenshotIdb();
    await idb.putFrame({
      id: 'post-upgrade',
      sessionId: 'session-idb',
      capturedAt: 2,
      pageUrl: null,
      width: 2,
      height: 2,
      format: 'jpeg',
      storageRef: 'post-upgrade',
      status: 'captured',
    });

    const frames = await idb.getAllFrames();
    expect(frames.some((item) => item.id === 'post-upgrade')).toBe(true);
  });
});
