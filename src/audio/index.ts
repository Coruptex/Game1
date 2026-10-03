/**
 * Ember of Retribution audio: fully synthesized at runtime with the Web Audio API.
 *
 *   const audio = new AudioManager();
 *   titleScreen.onAnyKey(() => audio.unlock());          // user gesture
 *   audio.setAmbience(AMBIENCE_PRESETS.jungle);          // on region change
 *   audio.play('swordSwing', { position: enemyPos });    // one-shots
 *   audio.update(dt, { x, y, z, yaw: camera.yaw });      // every frame
 */
export { AudioManager, distanceGain, panFor } from './AudioManager';
export type { ListenerState, PlayOptions, Vec3Like, VolumeChannel } from './AudioManager';
export { Ambience, AMBIENCE_LAYERS, AMBIENCE_PRESETS } from './Ambience';
export type { AmbienceLayer, AmbienceMix, AmbiencePreset } from './Ambience';
export { SOUND_IDS, footstepForSurface, isSoundId } from './SoundIds';
export type { SoundId } from './SoundIds';
export { SOUND_INFO, playSynth } from './SoundLibrary';
export type { SoundInfo, SynthOptions } from './SoundLibrary';
export { MixGraph } from './MixGraph';
export { SAMPLE_MANIFEST } from './SampleManifest';
