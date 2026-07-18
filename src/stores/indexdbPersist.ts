import { parsePersistedState } from "./volumePersistence";
import type { VolumePersistence } from "./volumePersistence.types";

const openIndexedDb = (dbName: string): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("volume")) {
        db.createObjectStore("volume");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const idbRequest = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/** Persists volumes to IndexedDB as plain JSON. */
export const indexdbPersist = <TCategory extends string = string>(
  key: string,
  dbName = "audio-engine"
): VolumePersistence<TCategory> => ({
  key,
  load: async () => {
    const db = await openIndexedDb(dbName);
    try {
      const raw = await idbRequest(
        db.transaction("volume").objectStore("volume").get(key)
      );
      return parsePersistedState<TCategory>(typeof raw === "string" ? raw : null);
    } finally {
      db.close();
    }
  },
  save: async (state) => {
    const db = await openIndexedDb(dbName);
    try {
      await idbRequest(
        db
          .transaction("volume", "readwrite")
          .objectStore("volume")
          .put(JSON.stringify(state), key)
      );
    } finally {
      db.close();
    }
  },
  remove: async () => {
    const db = await openIndexedDb(dbName);
    try {
      await idbRequest(
        db.transaction("volume", "readwrite").objectStore("volume").delete(key)
      );
    } finally {
      db.close();
    }
  },
});
