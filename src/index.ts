export type {
  ListenerOrientation,
  PlayPayloadForConfig,
  PlayPayloadForEvent,
  SoundConfig,
  SoundConfigShape,
  SoundConfigMap,
  SpatialAudioEngineOptions,
  VolumeState,
  VolumeStoreApi,
  WorldPosition,
} from "./types";

export {
  setAudioContext,
  getAudioContext,
} from "./context/audioContextRegistry";
export { loadAudioBuffer, clearAudioBufferCache } from "./core/bufferLoader";
export { syncAudioListener } from "./core/listenerSync";
export { SpatialAudioEngine } from "./core/spatialAudioEngine";
export { defineSoundConfigs, forEvents } from "./defineSoundConfigs";
export {
  getCategoryVolume,
  MAX_VOLUME,
  MIN_VOLUME,
  toVolumeState,
} from "./core/volume";

// Stores
export {
  createAudioVolumeStore,
  type AudioVolumeStore,
} from "./stores/createAudioVolumeStore";
export {
  getVolumePersistedState,
  hydrateVolumeStore,
} from "./stores/volumePersistence";
export { indexdbPersist } from "./stores/indexdbPersist";
export {
  localStoragePersist,
  sessionStoragePersist,
} from "./stores/webStoragePersist";
export type {
  VolumePersistence,
  VolumePersistedState,
} from "./stores/volumePersistence.types";
