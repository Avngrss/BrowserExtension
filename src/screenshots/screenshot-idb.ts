import type {
  ScreenshotFrame,
  ScreenshotIssueLink,
} from '@/src/domain/screenshot-evidence';

export const SCREENSHOT_IDB_NAME = 'bug-capture-screenshots';
export const SCREENSHOT_METADATA_STORE = 'metadata';
export const SCREENSHOT_FRAMES_STORE = 'frames';
export const SCREENSHOT_LINKS_STORE = 'issueLinks';
export const SCREENSHOT_BLOB_STORE = 'blobs';
export const SCREENSHOT_IDB_VERSION = 2;

type LegacyScreenshotRecord = {
  id: string;
  sessionId: string;
  issueCategory?: string;
  issueId?: string;
  capturedAt: number;
  pageUrl: string | null;
  width: number;
  height: number;
  format: 'jpeg';
  storageRef: string;
  status: ScreenshotFrame['status'];
  failureReason?: ScreenshotFrame['failureReason'];
};

export type ScreenshotIdbAdapter = {
  putFrame(frame: ScreenshotFrame): Promise<void>;
  getFrame(id: string): Promise<ScreenshotFrame | null>;
  getAllFrames(): Promise<ScreenshotFrame[]>;
  deleteFrame(id: string): Promise<void>;
  clearFrames(): Promise<void>;
  putLink(link: ScreenshotIssueLink): Promise<void>;
  getAllLinks(): Promise<ScreenshotIssueLink[]>;
  deleteLink(
    screenshotId: string,
    issueCategory: string,
    issueId: string,
  ): Promise<void>;
  clearLinks(): Promise<void>;
  putBlob(storageRef: string, blob: Blob): Promise<void>;
  getBlob(storageRef: string): Promise<Blob | null>;
  deleteBlob(storageRef: string): Promise<void>;
  clearBlobs(): Promise<void>;
  clearAll(): Promise<void>;
};

let sharedDatabase: IDBDatabase | null = null;
let openDatabasePromise: Promise<IDBDatabase> | null = null;
let operationQueue: Promise<unknown> = Promise.resolve();

export function resetScreenshotIdbConnectionForTests(): void {
  if (sharedDatabase !== null) {
    sharedDatabase.close();
    sharedDatabase = null;
  }
  openDatabasePromise = null;
  operationQueue = Promise.resolve();
}

export async function deleteScreenshotDatabaseForTests(): Promise<void> {
  resetScreenshotIdbConnectionForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(SCREENSHOT_IDB_NAME);
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB delete failed.'));
    };
    request.onblocked = () => {
      reject(new Error('IndexedDB delete blocked.'));
    };
  });
}

function enqueueIdbOperation<T>(operation: () => Promise<T>): Promise<T> {
  const run = operationQueue.then(() => operation());
  operationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function migrateLegacyRecord(record: LegacyScreenshotRecord): {
  frame: ScreenshotFrame;
  link: ScreenshotIssueLink | null;
} {
  const frame: ScreenshotFrame = {
    id: record.id,
    sessionId: record.sessionId,
    capturedAt: record.capturedAt,
    pageUrl: record.pageUrl,
    width: record.width,
    height: record.height,
    format: record.format,
    storageRef: record.storageRef,
    status: record.status,
    failureReason: record.failureReason,
  };
  if (
    typeof record.issueCategory === 'string' &&
    typeof record.issueId === 'string' &&
    (record.issueCategory === 'ui' ||
      record.issueCategory === 'console' ||
      record.issueCategory === 'network')
  ) {
    return {
      frame,
      link: {
        screenshotId: record.id,
        issueCategory: record.issueCategory,
        issueId: record.issueId,
        sessionId: record.sessionId,
      },
    };
  }
  return { frame, link: null };
}

export function runLegacyMetadataMigration(
  upgradeTx: IDBTransaction,
  db: IDBDatabase,
): void {
  const metadataStore = upgradeTx.objectStore(SCREENSHOT_METADATA_STORE);
  const framesStore = upgradeTx.objectStore(SCREENSHOT_FRAMES_STORE);
  const linksStore = upgradeTx.objectStore(SCREENSHOT_LINKS_STORE);

  const cursorRequest = metadataStore.openCursor();
  cursorRequest.onsuccess = (cursorEvent) => {
    try {
      const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue>)
        .result;
      if (cursor === null) {
        if (db.objectStoreNames.contains(SCREENSHOT_METADATA_STORE)) {
          db.deleteObjectStore(SCREENSHOT_METADATA_STORE);
        }
        return;
      }
      const { frame, link } = migrateLegacyRecord(
        cursor.value as LegacyScreenshotRecord,
      );
      framesStore.put(frame);
      if (link !== null) {
        linksStore.put(link);
      }
      cursor.continue();
    } catch {
      upgradeTx.abort();
    }
  };
  cursorRequest.onerror = () => {
    upgradeTx.abort();
  };
}

function openScreenshotDatabase(): Promise<IDBDatabase> {
  if (sharedDatabase !== null) {
    return Promise.resolve(sharedDatabase);
  }
  if (openDatabasePromise !== null) {
    return openDatabasePromise;
  }

  openDatabasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(SCREENSHOT_IDB_NAME, SCREENSHOT_IDB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const hadLegacyMetadata =
        event.oldVersion > 0 &&
        event.oldVersion < SCREENSHOT_IDB_VERSION &&
        db.objectStoreNames.contains(SCREENSHOT_METADATA_STORE);

      if (!db.objectStoreNames.contains(SCREENSHOT_FRAMES_STORE)) {
        db.createObjectStore(SCREENSHOT_FRAMES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SCREENSHOT_LINKS_STORE)) {
        const store = db.createObjectStore(SCREENSHOT_LINKS_STORE, {
          keyPath: ['screenshotId', 'issueCategory', 'issueId'],
        });
        store.createIndex('sessionId', 'sessionId', { unique: false });
      }
      if (!db.objectStoreNames.contains(SCREENSHOT_BLOB_STORE)) {
        db.createObjectStore(SCREENSHOT_BLOB_STORE);
      }

      if (hadLegacyMetadata) {
        const upgradeTx = request.transaction;
        if (upgradeTx !== null) {
          runLegacyMetadataMigration(upgradeTx, db);
        }
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      sharedDatabase = db;
      openDatabasePromise = null;
      db.onversionchange = () => {
        db.close();
        if (sharedDatabase === db) {
          sharedDatabase = null;
        }
      };
      resolve(db);
    };
    request.onerror = () => {
      openDatabasePromise = null;
      reject(request.error ?? new Error('IndexedDB open failed.'));
    };
    request.onblocked = () => {
      openDatabasePromise = null;
      reject(new Error('IndexedDB open blocked.'));
    };
  });

  return openDatabasePromise;
}

function runTransaction<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  run: (transaction: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  return enqueueIdbOperation(() =>
    openScreenshotDatabase().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const transaction = db.transaction(storeNames, mode);
          transaction.onerror = () => {
            reject(
              transaction.error ?? new Error('IndexedDB transaction failed.'),
            );
          };
          transaction.onabort = () => {
            reject(
              transaction.error ?? new Error('IndexedDB transaction aborted.'),
            );
          };

          try {
            const outcome = run(transaction);
            if (outcome instanceof Promise) {
              void outcome
                .then((value) => {
                  resolve(value);
                })
                .catch((error: unknown) => {
                  transaction.abort();
                  reject(
                    error instanceof Error
                      ? error
                      : new Error('IndexedDB transaction failed.'),
                  );
                });
              return;
            }
            transaction.oncomplete = () => {
              resolve(outcome);
            };
          } catch (error: unknown) {
            transaction.abort();
            reject(
              error instanceof Error
                ? error
                : new Error('IndexedDB transaction failed.'),
            );
          }
        }),
    ),
  );
}

export function createBrowserScreenshotIdb(): ScreenshotIdbAdapter {
  return {
    putFrame(frame) {
      return runTransaction(SCREENSHOT_FRAMES_STORE, 'readwrite', (tx) => {
        tx.objectStore(SCREENSHOT_FRAMES_STORE).put(frame);
      });
    },
    getFrame(id) {
      return runTransaction(SCREENSHOT_FRAMES_STORE, 'readonly', (tx) => {
        return new Promise<ScreenshotFrame | null>((resolve, reject) => {
          const request = tx.objectStore(SCREENSHOT_FRAMES_STORE).get(id);
          request.onsuccess = () => {
            resolve((request.result as ScreenshotFrame | undefined) ?? null);
          };
          request.onerror = () => {
            reject(request.error ?? new Error('IndexedDB read failed.'));
          };
        });
      });
    },
    getAllFrames() {
      return runTransaction(SCREENSHOT_FRAMES_STORE, 'readonly', (tx) => {
        return new Promise<ScreenshotFrame[]>((resolve, reject) => {
          const request = tx.objectStore(SCREENSHOT_FRAMES_STORE).getAll();
          request.onsuccess = () => {
            resolve((request.result as ScreenshotFrame[]) ?? []);
          };
          request.onerror = () => {
            reject(request.error ?? new Error('IndexedDB read failed.'));
          };
        });
      });
    },
    deleteFrame(id) {
      return runTransaction(SCREENSHOT_FRAMES_STORE, 'readwrite', (tx) => {
        tx.objectStore(SCREENSHOT_FRAMES_STORE).delete(id);
      });
    },
    clearFrames() {
      return runTransaction(SCREENSHOT_FRAMES_STORE, 'readwrite', (tx) => {
        tx.objectStore(SCREENSHOT_FRAMES_STORE).clear();
      });
    },
    putLink(link) {
      return runTransaction(SCREENSHOT_LINKS_STORE, 'readwrite', (tx) => {
        tx.objectStore(SCREENSHOT_LINKS_STORE).put(link);
      });
    },
    getAllLinks() {
      return runTransaction(SCREENSHOT_LINKS_STORE, 'readonly', (tx) => {
        return new Promise<ScreenshotIssueLink[]>((resolve, reject) => {
          const request = tx.objectStore(SCREENSHOT_LINKS_STORE).getAll();
          request.onsuccess = () => {
            resolve((request.result as ScreenshotIssueLink[]) ?? []);
          };
          request.onerror = () => {
            reject(request.error ?? new Error('IndexedDB read failed.'));
          };
        });
      });
    },
    deleteLink(screenshotId, issueCategory, issueId) {
      return runTransaction(SCREENSHOT_LINKS_STORE, 'readwrite', (tx) => {
        tx.objectStore(SCREENSHOT_LINKS_STORE).delete([
          screenshotId,
          issueCategory,
          issueId,
        ]);
      });
    },
    clearLinks() {
      return runTransaction(SCREENSHOT_LINKS_STORE, 'readwrite', (tx) => {
        tx.objectStore(SCREENSHOT_LINKS_STORE).clear();
      });
    },
    putBlob(storageRef, blob) {
      return runTransaction(SCREENSHOT_BLOB_STORE, 'readwrite', (tx) => {
        tx.objectStore(SCREENSHOT_BLOB_STORE).put(blob, storageRef);
      });
    },
    getBlob(storageRef) {
      return runTransaction(SCREENSHOT_BLOB_STORE, 'readonly', (tx) => {
        return new Promise<Blob | null>((resolve, reject) => {
          const request = tx.objectStore(SCREENSHOT_BLOB_STORE).get(storageRef);
          request.onsuccess = () => {
            const value: unknown = request.result;
            resolve(value instanceof Blob ? value : null);
          };
          request.onerror = () => {
            reject(request.error ?? new Error('IndexedDB read failed.'));
          };
        });
      });
    },
    deleteBlob(storageRef) {
      return runTransaction(SCREENSHOT_BLOB_STORE, 'readwrite', (tx) => {
        tx.objectStore(SCREENSHOT_BLOB_STORE).delete(storageRef);
      });
    },
    clearBlobs() {
      return runTransaction(SCREENSHOT_BLOB_STORE, 'readwrite', (tx) => {
        tx.objectStore(SCREENSHOT_BLOB_STORE).clear();
      });
    },
    clearAll() {
      return runTransaction(
        [
          SCREENSHOT_FRAMES_STORE,
          SCREENSHOT_LINKS_STORE,
          SCREENSHOT_BLOB_STORE,
        ],
        'readwrite',
        (tx) => {
          tx.objectStore(SCREENSHOT_FRAMES_STORE).clear();
          tx.objectStore(SCREENSHOT_LINKS_STORE).clear();
          tx.objectStore(SCREENSHOT_BLOB_STORE).clear();
        },
      );
    },
  };
}
