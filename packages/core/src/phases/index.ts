export { buildPhasePrompt, isPhaseSequenceComplete, nextPhase } from './sequencer';
export { PhaseContextPropagator, type PhaseContextPropagatorDeps } from './propagator';
// registry.ts (@kay-am/db → node) is intentionally excluded from this browser-safe barrel.
// Import directly from packages/core/src/phases/registry in Node/Tauri command contexts.
