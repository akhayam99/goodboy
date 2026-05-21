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
  assessPlanReadiness,
  extractFilesTouched,
  extractHandoff,
  extractMarkers,
  extractPlanFromMarker,
  mergeIntoSlot,
  removeFromSlot,
  type ExtractedHandoff,
  type ExtractedPlan,
  type PlanReadinessInput,
  type PlanReadinessResult,
} from './extractors';
export {
  autoPopulateContext,
  type AutoPopulateInput,
  type AutoPopulateResult,
} from './auto-populate';
