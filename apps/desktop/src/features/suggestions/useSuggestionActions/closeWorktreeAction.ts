import type { MountId, SessionId } from '@goodboy/types';
import { NAMES } from '../../../shared/utils/names';
import type { SessionSuggestion } from '../types';
import type { SuggestionActions } from '.';

type Worktrees = Extract<
  SessionSuggestion,
  { readonly kind: 'close-worktree' }
>['payload']['worktrees'];

type RequestParams = {
  readonly requestId: string;
};

type ResolveParams = {
  readonly sessionId: SessionId;
  readonly requestId: string;
  readonly decision: 'remove';
};

type RemoveParams = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly mode: 'safe';
};

type RemoveResult = {
  readonly kind: string;
  readonly reason?: string | null;
};

type Params = {
  readonly sessionId: SessionId;
  readonly worktrees: Worktrees;
  readonly isProposed: (params: RequestParams) => boolean;
  readonly resolveCleanup: (params: ResolveParams) => Promise<unknown>;
  readonly removeWorktree: (params: RemoveParams) => Promise<RemoveResult>;
};

export const closeWorktreeAction = ({
  sessionId,
  worktrees,
  isProposed,
  resolveCleanup,
  removeWorktree,
}: Params): SuggestionActions['primary'] => {
  const isMany = worktrees.length > 1;
  return {
    label: isMany ? NAMES.removeWorktrees : NAMES.removeWorktree,
    shortLabel: 'Remove',
    isDisabled: false,
    requiresConfirm: true,
    failureTitle: isMany ? "Couldn't remove the worktrees" : "Couldn't remove the worktree",
    run: async () => {
      for (const worktree of worktrees) {
        if (isProposed({ requestId: worktree.requestId })) {
          await resolveCleanup({ sessionId, requestId: worktree.requestId, decision: 'remove' });
          continue;
        }
        const result = await removeWorktree({
          sessionId,
          mountId: worktree.mountId,
          mode: 'safe',
        });
        if (result.kind === 'kept' || result.kind === 'failed') {
          throw new Error(result.reason ?? `The ${worktree.branch} worktree stayed.`);
        }
      }
    },
  };
};
