// SummarizerCli (node:child_process) is intentionally excluded from this browser-safe barrel.
// Import directly from packages/core/src/summarizer/cli in Node/test contexts.
export {
  getCheapModel,
  getDefaultBinary,
  Summarizer,
  SummarizerParseError,
  SummarizerSpawnError,
  type ContextSlotDelta,
  type ContextSlotDeltaUpsert,
  type SummarizeInput,
  type SummarizerDeps,
  type SummarizerResult,
  type SummarizerUsage,
} from './client';
export {
  inferNextActions,
  type InferNextActionsInput,
  type NextAction,
  type NextActionKind,
  type NextActionsPrState,
} from './next-actions';
