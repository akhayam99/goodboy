import { MOCK_ENABLED } from '../../../store/mock-data';
import type { AskBackend } from './askBackend';
import { createMemoryAskBackend } from './createMemoryAskBackend';
import { mockAskResponder } from './mockAskResponder';
import { tauriAskBackend } from './tauriAskBackend';

export const activeAskBackend: AskBackend = MOCK_ENABLED
  ? createMemoryAskBackend({ respond: mockAskResponder })
  : tauriAskBackend;
