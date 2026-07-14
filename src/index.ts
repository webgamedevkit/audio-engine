export type {
  ListenerOrientation,
  SoundConfig,
  SpatialAudioEngineOptions,
  VolumeState,
  VolumeStoreApi,
  WorldPosition,
} from "./types";

export { setAudioContext, getAudioContext } from "./context/audioContextRegistry";
export { loadAudioBuffer, clearAudioBufferCache } from "./core/bufferLoader";
export { syncAudioListener } from "./core/listenerSync";
export {
  generatePlaceholderSound,
  type PlaceholderSoundType,
} from "./core/proceduralSounds";
export { SpatialAudioEngine } from "./core/spatialAudioEngine";
export {
  getCategoryVolume,
  MAX_VOLUME,
  MIN_VOLUME,
  toVolumeState,
} from "./core/volume";
