import { parseResetOutcome } from '@goodboy/core';
import { invoke } from '@tauri-apps/api/core';
import type { CodexResetResult, GetFn, SetFn } from './types';

const attemptKey = (get: GetFn): string =>
  get().codexPendingReset?.idempotencyKey ?? crypto.randomUUID();

export const consumeCodexResetCredit =
  (set: SetFn, get: GetFn) => async (): Promise<CodexResetResult> => {
    const idempotencyKey = attemptKey(get);
    set({ codexPendingReset: { idempotencyKey } });
    const response = await invoke<unknown>('codex_consume_reset_credit', {
      idempotencyKey,
    }).catch(() => null);
    const outcome = parseResetOutcome({ value: response });
    if (outcome === null) {
      return 'failed';
    }
    set({ codexPendingReset: null });
    if (outcome === 'noCredit') {
      const credits = get().codexResetCredits;
      set({
        codexResetCredits:
          credits === null ? null : { ...credits, availableCount: 0, creditId: null },
      });
      return 'noCredit';
    }
    if (outcome === 'nothingToReset') {
      return 'nothingToReset';
    }
    await get().refreshCodexLimits({ withResetDetails: true });
    return 'reset';
  };
