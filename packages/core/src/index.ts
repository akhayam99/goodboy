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
  SLOT_LABELS,
  assertSlotKey,
  isSlotKey,
  serializeSlots,
  type ContextEngineDeps,
  type SlotKey,
} from './context';

export { computeCostUsd, priceFor } from './providers/claude/cost';
export { parseStreamJsonLine, type ParseContext } from './providers/claude/parser';

// registry.ts (node:child_process) is intentionally excluded from this browser-safe barrel.
// Import directly from @kay-am/core/src/providers/registry when needed in Node context.
export {
  PROVIDER_CAPABILITIES,
  getCapabilities,
  getDefaultTurnModel,
} from './providers/capabilities';

// CursorAdapter (node:child_process) is intentionally excluded from this browser-safe barrel.
// Import directly from @kay-am/core/src/providers/cursor/adapter when needed in Node context.
export { CURSOR_CHEAP_MODEL } from './providers/cursor/cost';
export {
  parseCursorStreamLine,
  type ParseContext as CursorParseContext,
} from './providers/cursor/parser';

// CodexAdapter (node:child_process) is intentionally excluded from this browser-safe barrel.
// Import directly from packages/core/src/providers/codex/adapter in Node contexts.
export { CODEX_CHEAP_MODEL } from './providers/codex/constants';
export {
  parseJsonLine as parseCodexJsonLine,
  type ParseContext as CodexParseContext,
} from './providers/codex/parser';

// SummarizerCli (node:child_process) is intentionally excluded from this browser-safe barrel.
// Import directly from packages/core/src/summarizer/cli in Node/test contexts.
export {
  Summarizer,
  SummarizerParseError,
  SummarizerSpawnError,
  type ContextSlotDelta,
  type ContextSlotDeltaUpsert,
  type SummarizeInput,
  type SummarizerDeps,
  type SummarizerResult,
  type SummarizerUsage,
} from './summarizer';
