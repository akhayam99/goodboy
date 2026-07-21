import type { SlotKey } from './slots';

export const SLOT_BUDGETS = {
  goal: 280,
  decisions: 1_200,
  open_questions: 800,
  files_touched: 1_600,
  last_output_summary: 900,
} satisfies Record<SlotKey, number>;

export const PREAMBLE_SLOT_TOTAL_BUDGET = 5_600;
