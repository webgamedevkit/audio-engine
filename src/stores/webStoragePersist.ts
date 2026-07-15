import { parsePersistedState } from "./volumePersistence";
import type { VolumePersistence } from "./volumePersistence.types";

const createWebStoragePersist = <TCategory extends string = string>(
  key: string,
  storage: Storage
): VolumePersistence<TCategory> => ({
  key,
  load: () => parsePersistedState<TCategory>(storage.getItem(key)),
  save: (state) => {
    storage.setItem(key, JSON.stringify(state));
  },
  remove: () => {
    storage.removeItem(key);
  },
});

/** Persists volumes to `localStorage` as plain JSON. */
export const localStoragePersist = <TCategory extends string = string>(
  key: string
): VolumePersistence<TCategory> => createWebStoragePersist(key, localStorage);

/** Persists volumes to `sessionStorage` as plain JSON. */
export const sessionStoragePersist = <TCategory extends string = string>(
  key: string
): VolumePersistence<TCategory> => createWebStoragePersist(key, sessionStorage);
