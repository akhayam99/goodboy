export { ContextEngine, type ContextEngineDeps } from './engine';
export {
  assertSlotKey,
  InvalidSlotKeyError,
  isSlotKey,
  serializeSlots,
  SLOT_KEYS,
  SLOT_LABELS,
  type SlotKey,
} from './slots';
export {
  extractFilesTouched,
  extractMarkers,
  extractPlanFromMarker,
  mergeIntoSlot,
  removeFromSlot,
  type ExtractedPlan,
} from './extractors';
export {
  autoPopulateContext,
  type AutoPopulateInput,
  type AutoPopulateResult,
} from './auto-populate';
