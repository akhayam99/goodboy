// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type SessionId,
  type StepId,
  type WorkflowRunId,
} from '@goodboy/types';
import { anAgent, aSession, aWorkflowRun } from '@goodboy/types/testing';
import { useAppStore } from '../../store';
import type { AppState } from '../../types';
import { BOARD_PLACE, branchPlace, sessionPlace } from './place';
import type { Place } from './types';
import { upTrailOf } from './upTrailOf';

const S1 = brandId<SessionId>({ value: 'session-ledger-core' });
const SCOUT = brandId<AgentId>({ value: 'agent-scout' });
const STEP = brandId<AgentId>({ value: 'agent-step' });
const RESOLVER = brandId<AgentId>({ value: 'agent-resolver' });
const ARTIFACT = brandId<ArtifactId>({ value: 'artifact-1' });
const DYNAMIC_RUN = brandId<WorkflowRunId>({ value: 'run-dynamic' });
const PRESET_RUN = brandId<WorkflowRunId>({ value: 'run-preset' });
const TITLE = 'Guard the settlement batch';

const STATE: AppState = {
  ...useAppStore.getInitialState(),
  sessions: [
    aSession({
      id: S1,
      goal: TITLE,
      workflowRuns: [
        aWorkflowRun({ id: DYNAMIC_RUN, executionMode: 'dynamic' }),
        aWorkflowRun({ id: PRESET_RUN }),
      ],
    }),
  ],
  sessionPhaseRuns: {
    [S1]: [
      anAgent({ id: SCOUT, sessionId: S1, name: 'scout' }),
      anAgent({
        id: STEP,
        sessionId: S1,
        name: 'implementer',
        workflowRunId: DYNAMIC_RUN,
        stepId: brandId<StepId>({ value: 'step-1' }),
      }),
      anAgent({ id: RESOLVER, sessionId: S1, name: 'resolve: ana on a.ts:4' }),
    ],
  },
  agentKindOverride: { [RESOLVER]: 'resolver' },
};

const agentAt = ({ agentId }: { readonly agentId: AgentId }): Place =>
  sessionPlace({ sessionId: S1, agentId });

type TrailParams = {
  readonly place: Place;
};

const labelsOf = ({ place }: TrailParams): ReadonlyArray<string> =>
  upTrailOf({ state: STATE, place, onUp: () => undefined }).map((segment) => segment.label);

describe('upTrailOf', () => {
  it.each<readonly [string, Place, ReadonlyArray<string>]>([
    ['the board', BOARD_PLACE, ['Sessions']],
    ['the Overview', sessionPlace({ sessionId: S1 }), [TITLE]],
    ['an old Agents address', sessionPlace({ sessionId: S1, lens: 'agents' }), [TITLE, 'Runs']],
    [
      'an orchestrated run',
      sessionPlace({
        sessionId: S1,
        lens: 'workflows',
        target: { kind: 'run', runId: DYNAMIC_RUN },
      }),
      [TITLE, 'Runs', 'Run'],
    ],
    [
      'a preset run',
      sessionPlace({
        sessionId: S1,
        lens: 'workflows',
        target: { kind: 'run', runId: PRESET_RUN },
      }),
      [TITLE, 'Runs', 'Run'],
    ],
    ['a run step', agentAt({ agentId: STEP }), [TITLE, 'Runs', 'Run', 'implementer']],
    ['an agent', agentAt({ agentId: SCOUT }), [TITLE, 'Runs', 'scout']],
    ['a resolver', agentAt({ agentId: RESOLVER }), [TITLE, 'Comments', 'resolve: ana on a.ts:4']],
    [
      'an artifact',
      sessionPlace({
        sessionId: S1,
        lens: 'plans',
        target: { kind: 'artifact', artifactId: ARTIFACT },
      }),
      [TITLE, 'Artifacts', 'Artifact'],
    ],
    [
      'an issue',
      sessionPlace({
        sessionId: S1,
        lens: 'github_issue',
        target: { kind: 'github-issue', issueNumber: 12 },
      }),
      [TITLE, 'GitHub issue', 'Issue'],
    ],
    ['a Branch section', branchPlace({ sessionId: S1, tab: 'commits' }), [TITLE, 'Branch']],
    [
      'a branch file',
      branchPlace({
        sessionId: S1,
        tab: 'files',
        focus: { kind: 'branch', path: 'src/ledger.ts' },
      }),
      [TITLE, 'Branch', 'File'],
    ],
    [
      'a thread',
      branchPlace({ sessionId: S1, tab: 'comments', threadId: 'thread-1' }),
      [TITLE, 'Branch', 'Thread'],
    ],
  ])('walks %s up to its session', (_name, place, labels) => {
    expect(labelsOf({ place })).toEqual(labels);
  });

  it('links every crumb but the last, each to its own place', () => {
    const ups: Array<Place> = [];
    const segments = upTrailOf({
      state: STATE,
      place: agentAt({ agentId: STEP }),
      onUp: ({ to }) => ups.push(to),
    });
    expect(segments.at(-1)?.onSelect).toBeUndefined();
    expect(segments.map((segment) => segment.tooltip)).toEqual([
      undefined,
      undefined,
      'Go up to Run',
      undefined,
    ]);
    expect(segments.at(-2)?.shortcut).toBe('nav.up');
    for (const segment of segments.slice(0, -1)) {
      segment.onSelect?.();
    }
    expect(ups).toEqual([
      sessionPlace({ sessionId: S1 }),
      sessionPlace({ sessionId: S1, lens: 'orchestrated' }),
      sessionPlace({
        sessionId: S1,
        lens: 'workflows',
        target: { kind: 'run', runId: DYNAMIC_RUN },
      }),
    ]);
  });
});
