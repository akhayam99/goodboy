// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type ArtifactComment,
  type ArtifactId,
  type OpenQuestion,
  type OpenQuestionId,
  type PlanArtifact,
  type ReportArtifact,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import {
  at,
  harborline,
  mergedGithub,
  openQuestionFor,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../workspace/testing/sessionColumn';
import { fixtureOf } from '../actions/testing/decideTestKit';
import type { SessionFields } from '../contract/projections';
import { projectionFieldsOf } from './projectionFieldsOf';
import { scopeOfState } from './scopeOfState';
import { shortNameOf } from './shortNameOf';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const NOW = Date.parse('2026-10-05T09:05:00.000Z');

const asking = sessionOf({
  goal: '[HBL-412] Retry window for the webhook and the ledger rounding',
});

const LEAD = 'agent-lead';
const BUILDER = 'agent-builder';

const planArtifact = (): PlanArtifact => ({
  id: brandId<ArtifactId>({ value: 'artifact-plan' }),
  sessionId: asking.id,
  agentId: brandId<AgentId>({ value: LEAD }),
  workflowRunId: null,
  kind: 'plan',
  schemaVersion: 1,
  title: 'Retry window plan',
  sourceFormat: 'markdown',
  sourceText: '# Plan\n- Add the retry window',
  metadata: {},
  status: 'active',
  revision: 2,
  sourceTurnId: null,
  createdAt: at('2026-10-05T08:00:00.000Z'),
  updatedAt: at('2026-10-05T08:30:00.000Z'),
  openedAt: null,
});

const reportArtifact = (): ReportArtifact => ({
  ...planArtifact(),
  id: brandId<ArtifactId>({ value: 'artifact-report' }),
  kind: 'report',
  title: 'Rounding report',
  sourceText: 'A short report',
  metadata: { reportType: 'audit' },
  revision: 1,
  agentId: brandId<AgentId>({ value: BUILDER }),
  updatedAt: at('2026-10-05T08:45:00.000Z'),
});

const longPlan = (): PlanArtifact => ({
  ...planArtifact(),
  id: brandId<ArtifactId>({ value: 'artifact-long' }),
  title: 'Long plan',
  sourceText: 'x'.repeat(7000),
  updatedAt: at('2026-10-05T07:00:00.000Z'),
});

const commentOn = ({ id }: { readonly id: string }): ArtifactComment => ({
  id: `comment-${id}`,
  sessionId: asking.id,
  artifactId: brandId<ArtifactId>({ value: id }),
  revision: 1,
  anchor: fixtureOf<ArtifactComment['anchor']>({ value: { kind: 'document' } }),
  body: 'Looks good',
  status: 'open',
  sentTurnId: null,
  createdAt: at('2026-10-05T08:50:00.000Z'),
  updatedAt: at('2026-10-05T08:50:00.000Z'),
});

const answered = (): OpenQuestion => ({
  ...openQuestionFor({ sessionId: asking.id }),
  id: brandId<OpenQuestionId>({ value: 'question-answered' }),
  text: 'Which currency does the ledger use?',
  suggestedAnswers: ['EUR', 'USD'],
  status: 'answered',
  userAnswer: 'EUR',
  createdAt: at('2026-10-04T09:00:00.000Z'),
  answeredAt: at('2026-10-04T09:10:00.000Z'),
  createdByAgentId: brandId<AgentId>({ value: BUILDER }),
});

const treeWithPlanAwaitingApproval = (): AutoTreeView =>
  fixtureOf<AutoTreeView>({
    value: {
      tree: { id: 'tree-1', rootAgentId: LEAD },
      delegations: [],
      hiddenChildIds: [],
      level: 'plan',
      artifacts: [
        {
          status: 'active',
          revision: 3,
          title: 'Ledger plan',
          sourceText: '# Ledger\n- Round at the edge',
          updatedAt: Date.parse('2026-10-05T09:00:00.000Z'),
          lastAuthor: 'Lead',
          artifact: {
            artifactId: 'artifact-ledger',
            kind: 'plan',
            approvalState: 'needs_approval',
            ownerAgentId: LEAD,
            ownerRole: 'lead',
            createdAt: 1,
          },
        },
      ],
    },
  });

const seed = (): void => {
  seedColumn({
    store: useAppStore,
    sessions: [asking],
    questions: [asking],
    mounts: [[asking, paymentsApi]],
  });
  useAppStore.setState({
    workspaces: [harborline],
    sessionGithub: { [asking.id]: mergedGithub() },
    sessionPhaseRuns: {
      [asking.id]: [
        fixtureOf({ value: { id: LEAD, sessionId: asking.id, name: 'Lead', status: 'running' } }),
        fixtureOf({
          value: {
            id: BUILDER,
            sessionId: asking.id,
            name: 'Builder',
            status: 'done',
            kind: 'implementer',
          },
        }),
      ],
    },
    sessionArtifacts: { [asking.id]: [planArtifact(), reportArtifact(), longPlan()] },
    artifactComments: {
      [asking.id]: [commentOn({ id: 'artifact-plan' }), commentOn({ id: 'artifact-plan' })],
    },
    sessionAnsweredQuestions: { [asking.id]: [answered()] },
    autoTreeViews: { [asking.id]: [treeWithPlanAwaitingApproval()] },
  });
};

const fieldsOf = (): SessionFields => {
  const state = useAppStore.getState();
  const scope = scopeOfState({
    workspace: harborline,
    state,
    sessions: state.sessions,
    isFullyLoaded: true,
  });
  const drafts = projectionFieldsOf({
    scopes: [scope],
    detailWorkspaceId: harborline.id,
    chips: { spendToday: null, limits: [] },
    now: NOW,
  });
  const draft = drafts.find(
    (candidate) => candidate.key === `session:${harborline.id}:${asking.id}`,
  );
  if (draft === undefined) {
    throw new Error('no session projection');
  }
  return JSON.parse(JSON.stringify(draft.fields));
};

describe('session projection v6', () => {
  it('names the session for the crumb without its task key', () => {
    seed();

    expect(fieldsOf().shortName).toBe('Retry window for the webhook…');
  });

  it('carries the pull request word and the run count on each project', () => {
    seed();

    const project = fieldsOf().projects[0];

    expect(project?.prState).toBe('Merged');
    expect(project?.prTone).toBe('merged');
    expect(project?.runCount).toBe(0);
    expect(project?.additions).toBeNull();
    expect(project?.deletions).toBeNull();
  });

  it('says No pull request for a session without one', () => {
    seed();
    useAppStore.setState({ sessionGithub: {} });

    expect(fieldsOf().projects[0]?.prState).toBe('No pull request');
  });

  it('lists artifacts with author, comments, approval and a capped body', () => {
    seed();

    const rows = fieldsOf().artifacts;
    const ledger = rows.find((row) => row.id === 'artifact-ledger');
    const plan = rows.find((row) => row.id === 'artifact-plan');
    const report = rows.find((row) => row.id === 'artifact-report');

    expect(rows).toHaveLength(4);
    expect(ledger).toMatchObject({
      kind: 'plan',
      version: 3,
      role: 'Lead',
      isAwaitingApproval: true,
      approveActionId: 'act:approvePlan:artifact-ledger:3',
      body: '# Ledger\n- Round at the edge',
      isBodyCut: false,
    });
    expect(plan).toMatchObject({
      role: 'Lead',
      commentCount: 2,
      isAwaitingApproval: false,
      approveActionId: null,
    });
    expect(report?.role).toBe('Implementer');
    expect(report?.body).toBeNull();
    expect(report?.isBodyCut).toBe(false);
    const long = rows.find((row) => row.id === 'artifact-long');
    expect(long?.isBodyCut).toBe(true);
    expect(long?.body?.length).toBe(4000);
  });

  it('lists open and answered questions with who asked and the answer', () => {
    seed();

    const [open, closed] = fieldsOf().questions;

    expect(open).toMatchObject({ state: 'open', answer: null, answeredAt: null });
    expect(open?.answerActionId).toContain('act:answerQuestion:');
    expect(closed).toMatchObject({
      state: 'answered',
      text: 'Which currency does the ledger use?',
      options: ['EUR', 'USD'],
      answer: 'EUR',
      askedBy: 'Implementer',
      answerActionId: null,
    });
  });

  it('counts runs, artifacts and open questions for the tabs', () => {
    seed();

    expect(fieldsOf().counts).toEqual({ runs: 0, artifacts: 4, openQuestions: 1 });
  });
});

describe('session projection limits', () => {
  it('leaves a discarded ledger plan out of the list, the count and the approval', () => {
    seed();
    const view = treeWithPlanAwaitingApproval();
    const discarded = { ...view.artifacts[0]!, status: 'discarded' };
    useAppStore.setState({ autoTreeViews: { [asking.id]: [{ ...view, artifacts: [discarded] }] } });

    const fields = fieldsOf();

    expect(fields.artifacts.some((row) => row.id === 'artifact-ledger')).toBe(false);
    expect(fields.artifacts.some((row) => row.isAwaitingApproval)).toBe(false);
    expect(fields.counts.artifacts).toBe(3);
  });

  it('budgets artifact bodies in UTF-8 bytes', () => {
    seed();
    const wide = (id: string): PlanArtifact => ({
      ...planArtifact(),
      id: brandId<ArtifactId>({ value: id }),
      title: id,
      sourceText: '漢'.repeat(4000),
    });
    useAppStore.setState({
      sessionArtifacts: { [asking.id]: [wide('wide-1'), wide('wide-2'), wide('wide-3')] },
      autoTreeViews: {},
    });

    const bytes = fieldsOf()
      .artifacts.map((row) => new TextEncoder().encode(JSON.stringify(row.body ?? '')).length)
      .reduce((sum, size) => sum + size, 0);
    const bodies = fieldsOf().artifacts.filter((row) => row.body !== null);

    expect(bytes).toBeLessThanOrEqual(20000 + 2 * 3);
    expect(bodies).toHaveLength(1);
    expect(fieldsOf().artifacts.filter((row) => row.isBodyCut)).toHaveLength(2);
  });

  it('counts every open question, not the twelve it sends', () => {
    seed();
    const many = Array.from({ length: 15 }, (_, index) => ({
      ...openQuestionFor({ sessionId: asking.id }),
      id: brandId<OpenQuestionId>({ value: `question-open-${index}` }),
    }));
    useAppStore.setState({ sessionOpenQuestions: { [asking.id]: many } });

    const fields = fieldsOf();

    expect(fields.questions.filter((question) => question.state === 'open')).toHaveLength(12);
    expect(fields.counts.openQuestions).toBe(15);
  });
});

describe('shortNameOf', () => {
  it('keeps a short goal whole', () => {
    expect(shortNameOf({ goal: 'Fix the rounding' })).toBe('Fix the rounding');
  });

  it('strips every leading key and cuts at a word boundary', () => {
    expect(
      shortNameOf({ goal: '[HBL-1] [ACME-2] Cascade the ledger rounding through payments-api' }),
    ).toBe('Cascade the ledger rounding…');
  });

  it('uses the first line only', () => {
    expect(shortNameOf({ goal: '\nFirst line\nSecond line' })).toBe('First line');
  });

  it('falls back for an empty goal', () => {
    expect(shortNameOf({ goal: '   ' })).toBe('Untitled session');
  });

  it('keeps the key when nothing else is left', () => {
    expect(shortNameOf({ goal: '[HBL-1]' })).toBe('[HBL-1]');
  });
});
