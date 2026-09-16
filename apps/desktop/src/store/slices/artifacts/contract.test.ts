import type {
  AgentId,
  ArtifactId,
  IsoDateTime,
  PlanArtifact,
  ReportArtifact,
  SessionArtifact,
  SessionId,
} from '@goodboy/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createArtifactsSlice,
  artifactsInitialState,
  selectArtifact,
  selectArtifactsByKind,
  selectPlanArtifacts,
  selectSessionArtifacts,
} from './index';
import type { ArtifactsState } from './state';
import type { GetFn, SetFn } from './types';

const listSpy = vi.fn<(sessionId: SessionId) => Promise<ReadonlyArray<SessionArtifact>>>(
  async () => [],
);
const updateSourceSpy = vi.fn<(args: unknown) => Promise<void>>(async () => undefined);
const setStatusSpy = vi.fn<(artifactId: ArtifactId, status: string) => Promise<void>>(
  async () => undefined,
);
const discardSpy = vi.fn<(artifactId: ArtifactId) => Promise<void>>(async () => undefined);
const restoreSpy = vi.fn<(artifactId: ArtifactId) => Promise<void>>(async () => undefined);

vi.mock('../../../features/artifacts/artifacts', () => ({
  listArtifactsForSession: (sessionId: SessionId) => listSpy(sessionId),
  updateArtifactSource: (args: unknown) => updateSourceSpy(args),
  setArtifactStatus: (artifactId: ArtifactId, status: string) => setStatusSpy(artifactId, status),
  discardArtifact: (artifactId: ArtifactId) => discardSpy(artifactId),
  restoreArtifact: (artifactId: ArtifactId) => restoreSpy(artifactId),
}));

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const PLAN_ID = 'plan-1' as ArtifactId;
const REPORT_ID = 'report-1' as ArtifactId;
const NOW = '2026-05-28T00:00:00.000Z' as IsoDateTime;

const planArtifact: PlanArtifact = {
  id: PLAN_ID,
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  workflowRunId: null,
  kind: 'plan',
  schemaVersion: 1,
  title: 'Plan',
  sourceFormat: 'markdown',
  sourceText: 'body',
  metadata: {},
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const reportArtifact: ReportArtifact = {
  ...planArtifact,
  id: REPORT_ID,
  kind: 'report',
  title: 'Report',
  metadata: { reportType: 'session-summary' },
};

let state: ArtifactsState;

const set: SetFn = (patch) => {
  const next = typeof patch === 'function' ? patch(state as never) : patch;
  state = { ...state, ...next } as ArtifactsState;
};

const get = (() => ({ ...state })) as unknown as GetFn;

const slice = () => createArtifactsSlice(set, get);

describe('artifacts slice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state = { ...artifactsInitialState };
    listSpy.mockResolvedValue([]);
  });

  it('loadSessionArtifacts fills sessionArtifacts for the session', async () => {
    listSpy.mockResolvedValueOnce([planArtifact, reportArtifact]);
    await slice().loadSessionArtifacts(SESSION_ID);
    expect(state.sessionArtifacts[SESSION_ID]).toEqual([planArtifact, reportArtifact]);
  });

  it('updateArtifactSource persists then refreshes', async () => {
    listSpy.mockResolvedValueOnce([{ ...reportArtifact, title: 'Report v2', revision: 2 }]);
    await slice().updateArtifactSource({
      sessionId: SESSION_ID,
      artifactId: REPORT_ID,
      title: 'Report v2',
      sourceFormat: 'markdown',
      sourceText: 'next',
      metadata: { reportType: 'session-summary' },
    });
    expect(updateSourceSpy).toHaveBeenCalledWith({
      artifactId: REPORT_ID,
      title: 'Report v2',
      sourceFormat: 'markdown',
      sourceText: 'next',
      metadata: { reportType: 'session-summary' },
    });
    expect(state.sessionArtifacts[SESSION_ID]?.[0]?.title).toBe('Report v2');
  });

  it('setArtifactStatus forwards the status', async () => {
    await slice().setArtifactStatus({
      sessionId: SESSION_ID,
      artifactId: PLAN_ID,
      status: 'superseded',
    });
    expect(setStatusSpy).toHaveBeenCalledWith(PLAN_ID, 'superseded');
  });

  it('deleteArtifact discards and restoreArtifact reactivates', async () => {
    await slice().deleteArtifact({ sessionId: SESSION_ID, artifactId: PLAN_ID });
    expect(discardSpy).toHaveBeenCalledWith(PLAN_ID);
    await slice().restoreArtifact({ sessionId: SESSION_ID, artifactId: PLAN_ID });
    expect(restoreSpy).toHaveBeenCalledWith(PLAN_ID);
  });

  it('selectors narrow by session, kind and id', () => {
    const populated: ArtifactsState = {
      sessionArtifacts: { [SESSION_ID]: [planArtifact, reportArtifact] },
      wireframeScoutVerification: {},
    };
    expect(selectSessionArtifacts({ state: populated, sessionId: SESSION_ID })).toHaveLength(2);
    expect(
      selectArtifactsByKind({ state: populated, sessionId: SESSION_ID, kind: 'report' }),
    ).toEqual([reportArtifact]);
    expect(selectPlanArtifacts({ state: populated, sessionId: SESSION_ID })).toEqual([
      planArtifact,
    ]);
    expect(
      selectArtifact({ state: populated, sessionId: SESSION_ID, artifactId: REPORT_ID }),
    ).toEqual(reportArtifact);
    expect(
      selectArtifact({ state: populated, sessionId: SESSION_ID, artifactId: 'nope' as ArtifactId }),
    ).toBeNull();
  });

  it('returns a stable empty list for an unknown session', () => {
    const empty = { sessionArtifacts: {} };
    expect(selectSessionArtifacts({ state: empty, sessionId: SESSION_ID })).toBe(
      selectSessionArtifacts({ state: empty, sessionId: 'other' as SessionId }),
    );
  });
});
