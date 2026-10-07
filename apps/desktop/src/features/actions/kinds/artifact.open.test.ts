// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArtifactId, IsoDateTime, ReportArtifact } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { useAppStore } from '../../../store';
import {
  PLAN_FIXTURE_ID,
  PLAN_FIXTURE_PLANNER,
  PLAN_FIXTURE_SESSION,
  aPlan,
  aStoredPlan,
} from '../../../test/planFixtures';
import type { ActionEnv } from '../types';
import { ARTIFACT_KIND } from './artifact';

const AT = '2026-10-05T10:00:00.000Z' as IsoDateTime;
const REPORT_ID = 'report-ledger-drift' as ArtifactId;

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

const report: ReportArtifact = {
  id: REPORT_ID,
  sessionId: PLAN_FIXTURE_SESSION,
  agentId: PLAN_FIXTURE_PLANNER,
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Ledger drift on Harborline',
  sourceFormat: 'markdown',
  sourceText: '# Ledger drift on Harborline',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: AT,
  updatedAt: AT,
  openedAt: null,
};

const seed = ({ lens }: { readonly lens: 'plans' | null }) => {
  const plan = aPlan();
  useAppStore.setState({
    sessions: [aSession({ id: PLAN_FIXTURE_SESSION })],
    sessionPlans: { [PLAN_FIXTURE_SESSION]: [plan] },
    sessionArtifacts: { [PLAN_FIXTURE_SESSION]: [aStoredPlan({}, plan), report] },
    sessionPhaseRuns: {},
    agentTurnState: {},
    artifactComments: {},
    currentSessionId: PLAN_FIXTURE_SESSION,
    activeLens: { [PLAN_FIXTURE_SESSION]: lens },
    selectedAgentId: { [PLAN_FIXTURE_SESSION]: lens === null ? PLAN_FIXTURE_PLANNER : null },
    drawer: null,
    navigate: vi.fn(),
  });
};

const open = async ({ artifactId }: { readonly artifactId: ArtifactId }) => {
  const facts = ARTIFACT_KIND.facts({
    state: useAppStore.getState(),
    target: {
      kind: 'artifact',
      sessionId: PLAN_FIXTURE_SESSION,
      subject: { kind: 'stored', artifactId, isPlanRunning: false },
    },
  });
  const definition = ARTIFACT_KIND.actions.find((action) => action.id === 'artifact.open');
  if (facts === null || definition === undefined) {
    throw new Error('the artifact facts or the Open action are missing');
  }
  await definition.run({ facts, env, choice: null });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Open on a plan', () => {
  it('opens the drawer from the planner page and leaves the page where it is', async () => {
    seed({ lens: null });

    await open({ artifactId: PLAN_FIXTURE_ID });

    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'artifact-document',
      sessionId: PLAN_FIXTURE_SESSION,
      payload: { artifactId: PLAN_FIXTURE_ID, revision: null },
    });
    expect(useAppStore.getState().navigate).not.toHaveBeenCalled();
    expect(useAppStore.getState().activeLens[PLAN_FIXTURE_SESSION]).toBeNull();
    expect(useAppStore.getState().selectedAgentId[PLAN_FIXTURE_SESSION]).toBe(PLAN_FIXTURE_PLANNER);
  });

  it('moves inside the Artifacts page when the user is already on it', async () => {
    seed({ lens: 'plans' });

    await open({ artifactId: PLAN_FIXTURE_ID });

    expect(useAppStore.getState().drawer).toBeNull();
    expect(useAppStore.getState().navigate).toHaveBeenCalledWith({
      to: {
        at: 'session',
        sessionId: PLAN_FIXTURE_SESSION,
        view: {
          lens: 'plans',
          agentId: null,
          studio: null,
          target: { kind: 'artifact', artifactId: PLAN_FIXTURE_ID },
        },
      },
    });
  });
});

describe('Open on a report', () => {
  it('still goes to the Artifacts page', async () => {
    seed({ lens: null });

    await open({ artifactId: REPORT_ID });

    expect(useAppStore.getState().drawer).toBeNull();
    expect(useAppStore.getState().navigate).toHaveBeenCalledWith({
      to: {
        at: 'session',
        sessionId: PLAN_FIXTURE_SESSION,
        view: {
          lens: 'plans',
          agentId: null,
          studio: null,
          target: { kind: 'artifact', artifactId: REPORT_ID },
        },
      },
    });
  });
});
