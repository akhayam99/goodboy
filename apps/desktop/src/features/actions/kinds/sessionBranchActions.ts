import type { ActionDefinition } from '../types';
import type { SessionFacts } from './session';
import { SESSION_CLEANUP_ACTIONS } from './sessionCleanupActions';
import { SESSION_REBASE_ACTIONS } from './sessionRebaseActions';

export const SESSION_BRANCH_ACTIONS: ReadonlyArray<ActionDefinition<SessionFacts>> = [
  ...SESSION_REBASE_ACTIONS,
  ...SESSION_CLEANUP_ACTIONS,
];
