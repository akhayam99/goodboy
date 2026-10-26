import type { MountId, SessionId, SessionProjectMount } from '@goodboy/types';
import type { ScriptRunRecord } from './scripts';

export type ScriptEndedDetail = {
  readonly sessionId: SessionId;
  readonly scriptKey: string;
  readonly runId: string;
};

export type ScriptEndNotice = {
  readonly kind: 'success' | 'warning';
  readonly message: string;
  readonly mountId: MountId | null;
};

type ScriptEndState = {
  readonly currentSessionId: SessionId | null;
  readonly scriptRuns: Readonly<Record<SessionId, Readonly<Record<string, ScriptRunRecord>>>>;
  readonly sessionProjectMounts: Readonly<
    Record<SessionId, ReadonlyArray<Pick<SessionProjectMount, 'mountId' | 'mountName'>>>
  >;
};

type Params = {
  readonly state: ScriptEndState;
  readonly detail: ScriptEndedDetail;
};

export const scriptEndNoticeOf = ({ state, detail }: Params): ScriptEndNotice | null => {
  const { sessionId, scriptKey, runId } = detail;
  if (state.currentSessionId === sessionId) {
    return null;
  }
  const record = state.scriptRuns[sessionId]?.[scriptKey];
  if (record === undefined || record.runId !== runId) {
    return null;
  }
  if (record.status !== 'ok' && record.status !== 'error') {
    return null;
  }
  const mountId = record.mountId ?? null;
  const project =
    mountId === null
      ? undefined
      : (state.sessionProjectMounts[sessionId] ?? []).find((mount) => mount.mountId === mountId)
          ?.mountName;
  const where = project === undefined ? '' : ` in ${project}`;
  const name = record.name ?? scriptKey;
  return record.status === 'error'
    ? { kind: 'warning', message: `${name} failed${where}`, mountId }
    : { kind: 'success', message: `${name} finished${where}`, mountId };
};
