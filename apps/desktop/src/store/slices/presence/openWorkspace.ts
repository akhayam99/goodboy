import type { Session, WorkspaceId } from '@goodboy/types';
import {
  currentWindowLabel,
  focusWindow,
  spawnWorkspaceWindow,
} from '../../../features/workspace/window';
import type { GetFn } from './types';

export type OpenWorkspaceTarget = 'auto' | 'new-window';
export type OpenWorkspaceOnRunning = 'ask' | 'new-window';

export type OpenWorkspaceParams = {
  readonly id: WorkspaceId;
  readonly title: string;
  readonly target?: OpenWorkspaceTarget;
  readonly onRunning?: OpenWorkspaceOnRunning;
};

export type OpenWorkspaceResult =
  { readonly kind: 'opened' } | { readonly kind: 'needs-confirm'; readonly running: number };

const RUNNING_SESSION_KINDS: ReadonlySet<string> = new Set(['running', 'starting']);

export const countRunningSessions = (sessions: ReadonlyArray<Session>): number =>
  sessions.filter((session) => RUNNING_SESSION_KINDS.has(session.state.kind)).length;

export const selectRunningHere = (get: GetFn): number => countRunningSessions(get().sessions);

export const openWorkspace = (get: GetFn) => {
  return async ({
    id,
    title,
    target = 'auto',
    onRunning = 'ask',
  }: OpenWorkspaceParams): Promise<OpenWorkspaceResult> => {
    const presence = get().windowPresence;
    const myLabel = currentWindowLabel();
    const shownLabel = Object.entries(presence).find(([, ws]) => ws === id)?.[0] ?? null;

    if (shownLabel === myLabel) {
      return { kind: 'opened' };
    }
    if (shownLabel !== null && (await focusWindow(shownLabel))) {
      return { kind: 'opened' };
    }
    if (get().currentWorkspaceId === null) {
      await get().switchWorkspaceHere({ id, title });
      return { kind: 'opened' };
    }
    if (target === 'new-window') {
      await spawnWorkspaceWindow(id, title);
      return { kind: 'opened' };
    }
    const running = selectRunningHere(get);
    if (running === 0) {
      await get().switchWorkspaceHere({ id, title });
      return { kind: 'opened' };
    }
    if (onRunning === 'new-window') {
      await spawnWorkspaceWindow(id, title);
      return { kind: 'opened' };
    }
    return { kind: 'needs-confirm', running };
  };
};
