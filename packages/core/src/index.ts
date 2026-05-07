export { IllegalSessionTransitionError, sessionReducer, type SessionEvent } from './session';

export {
  TelemetryRecorder,
  type RecordSummarizerInput,
  type RecordTurnInput,
  type TelemetryRecorderDeps,
} from './telemetry';

export {
  ContextEngine,
  InvalidSlotKeyError,
  SLOT_KEYS,
  assertSlotKey,
  isSlotKey,
  serializeSlots,
  type ContextEngineDeps,
  type SlotKey,
} from './context';

export { computeCostUsd, priceFor } from './providers/claude/cost';
export { parseStreamJsonLine, type ParseContext } from './providers/claude/parser';
