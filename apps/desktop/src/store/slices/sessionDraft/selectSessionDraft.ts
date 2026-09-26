import type { WorkspaceId } from '@goodboy/types';
import type { AppState } from '../../types';
import { EMPTY_SESSION_DRAFT, type SessionDraft } from './state';

type Params = {
  readonly state: Pick<AppState, 'sessionDrafts'>;
  readonly workspaceId: WorkspaceId | null;
};

export const selectSessionDraft = ({ state, workspaceId }: Params): SessionDraft =>
  workspaceId === null
    ? EMPTY_SESSION_DRAFT
    : (state.sessionDrafts[workspaceId] ?? EMPTY_SESSION_DRAFT);
