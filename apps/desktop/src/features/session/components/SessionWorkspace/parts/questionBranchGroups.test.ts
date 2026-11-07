// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type OpenQuestion,
  type OpenQuestionId,
} from '@goodboy/types';
import { aProject, anAgent, nextSessionId } from '@goodboy/types/testing';
import { aMountRow } from '../../../central/branches/testing/aMountRow';
import { aMountView } from '../../../testing/aMountView';
import {
  buildQuestionsLens,
  questionBranchCountOf,
  questionBranchGroupsOf,
} from './questionsLensModel';

const SESSION = nextSessionId();
const PAYMENTS = aProject({ name: 'payments-api' });
const NOTIFY = aProject({ name: 'notify-relay' });
const DUP = aMountView({
  key: 'dup',
  sessionId: SESSION,
  projectId: PAYMENTS.id,
  projectName: 'payments-api',
  branch: 'fix/duplicate-credit',
});
const RETRY = aMountView({
  key: 'retry',
  sessionId: SESSION,
  projectId: NOTIFY.id,
  projectName: 'notify-relay',
  branch: 'feat/retry-budget',
});
const DUP_ROW = aMountRow({
  key: 'dup',
  projectName: 'payments-api',
  branch: 'fix/duplicate-credit',
});
const RETRY_ROW = aMountRow({
  key: 'retry',
  projectName: 'notify-relay',
  branch: 'feat/retry-budget',
});
const MOUNT_ROWS = [DUP_ROW, RETRY_ROW];
const PROJECTS = [PAYMENTS, NOTIFY];
const AT = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });

const AT_DUP = anAgent({ sessionId: SESSION, name: 'Implementer', mountId: DUP.id });
const AT_RETRY = anAgent({ sessionId: SESSION, name: 'Scout', mountId: RETRY.id });
const LEAD = anAgent({ sessionId: SESSION, name: 'Orchestrator' });
const LEAD_ON_DUP = anAgent({ sessionId: SESSION, parentAgentId: LEAD.id, mountId: DUP.id });
const LEAD_ON_RETRY = anAgent({ sessionId: SESSION, parentAgentId: LEAD.id, mountId: RETRY.id });
const LOOSE = anAgent({ sessionId: SESSION, name: 'Planner' });

type QuestionParams = {
  readonly id: string;
  readonly askerId?: AgentId;
  readonly answeredAt?: IsoDateTime;
};

const questionOf = ({ id, askerId, answeredAt }: QuestionParams): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: id }),
  sessionId: SESSION,
  ...(askerId === undefined ? {} : { createdByAgentId: askerId }),
  text: id,
  suggestedAnswers: [],
  isBlocking: false,
  userAnswer: answeredAt === undefined ? null : 'yes',
  status: answeredAt === undefined ? 'open' : 'answered',
  createdAt: AT,
  ...(answeredAt === undefined ? {} : { answeredAt }),
});

const AGENTS = [AT_DUP, AT_RETRY, LEAD, LEAD_ON_DUP, LEAD_ON_RETRY, LOOSE];

type GroupsParams = {
  readonly open: ReadonlyArray<OpenQuestion>;
  readonly answered?: ReadonlyArray<OpenQuestion>;
  readonly mounts?: typeof MOUNT_ROWS;
  readonly sessionMounts?: ReadonlyArray<typeof DUP>;
};

const groupsOf = ({
  open,
  answered = [],
  mounts = MOUNT_ROWS,
  sessionMounts = [DUP, RETRY],
}: GroupsParams) =>
  questionBranchGroupsOf({
    model: buildQuestionsLens({ open, answered, agents: AGENTS, staged: [], dismissed: null }),
    agents: AGENTS,
    sessionMounts,
    projects: PROJECTS,
    mounts,
  });

const idsOf = (rows: ReadonlyArray<{ readonly row: { readonly question: OpenQuestion } }>) =>
  rows.map((item) => item.row.question.id);

describe('questionBranchGroupsOf', () => {
  it('puts the branch with a waiting question first and folds answered ones apart', () => {
    const groups = groupsOf({
      open: [questionOf({ id: 'retry-open', askerId: AT_RETRY.id })],
      answered: [questionOf({ id: 'dup-done', askerId: AT_DUP.id, answeredAt: AT })],
    });

    expect(groups.map((group) => group.key)).toEqual([`mount:${RETRY.id}`, `mount:${DUP.id}`]);
    expect(idsOf(groups[0]?.waiting ?? [])).toEqual(['retry-open']);
    expect(idsOf(groups[1]?.answered ?? [])).toEqual(['dup-done']);
    expect(groups[1]?.waiting).toEqual([]);
  });

  it('draws a question of an orchestrator in both branches it works on', () => {
    const groups = groupsOf({ open: [questionOf({ id: 'shared', askerId: LEAD.id })] });

    expect(groups.map((group) => idsOf(group.waiting))).toEqual([['shared'], ['shared']]);
    expect(groups.map((group) => group.key).sort()).toEqual(
      [`mount:${DUP.id}`, `mount:${RETRY.id}`].sort(),
    );
  });

  it('counts a replicated question once in the branch count of the lens', () => {
    const groups = groupsOf({ open: [questionOf({ id: 'shared', askerId: LEAD.id })] });

    expect(questionBranchCountOf({ groups })).toBe(2);
  });

  it('sends a question with no agent to No branch, last', () => {
    const groups = groupsOf({
      open: [questionOf({ id: 'loose' }), questionOf({ id: 'dup-open', askerId: AT_DUP.id })],
    });

    expect(groups.map((group) => group.head.kind)).toEqual(['branch', 'none']);
    expect(idsOf(groups[1]?.waiting ?? [])).toEqual(['loose']);
  });

  it('sends the question of an agent with no mount to No branch', () => {
    const groups = groupsOf({ open: [questionOf({ id: 'planner', askerId: LOOSE.id })] });

    expect(groups.map((group) => group.head.kind)).toEqual(['none']);
  });

  it('sends the questions of a detached mount to No branch', () => {
    const detached = { ...DUP, isAttached: false };
    const groups = groupsOf({
      open: [questionOf({ id: 'dup-open', askerId: AT_DUP.id })],
      sessionMounts: [detached, RETRY],
    });

    expect(groups.map((group) => group.head.kind)).toEqual(['none']);
    expect(idsOf(groups[0]?.waiting ?? [])).toEqual(['dup-open']);
  });

  it('reads one group when every question sits on one branch', () => {
    const groups = groupsOf({
      open: [
        questionOf({ id: 'one', askerId: AT_DUP.id }),
        questionOf({ id: 'two', askerId: AT_DUP.id }),
      ],
    });

    expect(groups).toHaveLength(1);
    expect(questionBranchCountOf({ groups })).toBe(1);
  });

  it('lands the parts of a series in the one group of the series', () => {
    const series = {
      seriesId: 'series-rec',
      name: 'Ledger reconciliation',
      position: 1,
      plannedCount: 2,
      label: '1',
    };
    const mounts = [
      { ...DUP_ROW, series },
      { ...RETRY_ROW, series: { ...series, position: 2, label: '2' } },
    ];
    const groups = groupsOf({
      open: [questionOf({ id: 'shared', askerId: LEAD.id })],
      mounts,
    });

    expect(groups.map((group) => group.key)).toEqual(['series:series-rec']);
    expect(idsOf(groups[0]?.waiting ?? [])).toEqual(['shared']);
  });
});
