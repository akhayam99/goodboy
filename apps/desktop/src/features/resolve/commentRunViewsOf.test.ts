import { describe, expect, it } from 'vitest';
import { brandId, type Agent, type AgentStatus, type MountId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { agentIdOf } from '../../__tests__/helpers/brandedIds';
import { SESSION_ID } from '../../app/components/MockScene/scenes/resolveSeed';
import { commentRunViewsOf } from './commentRunViewsOf';
import { noteThreadId } from './notes/noteThread';

const HEADER_NOTE = noteThreadId({ noteId: 'note-ledger-header' });
const FILTERS_NOTE = noteThreadId({ noteId: 'note-ledger-filters' });
const LAYOUT_THREAD = 'PRRT_harborline_ledger_layout';
const IMPORT_THREAD = 'PRRT_harborline_import_order';
const LEDGER_MOUNT = brandId<MountId>({ value: 'mount-ledger-layout' });

type LeadParams = {
  readonly id: string;
  readonly ordinal: number;
  readonly threadIds: ReadonlyArray<string>;
  readonly status?: AgentStatus;
};

const leadOf = ({ id, ordinal, threadIds, status = 'running' }: LeadParams): Agent =>
  anAgent({
    id: agentIdOf({ value: id }),
    sessionId: SESSION_ID,
    ordinal,
    name: id,
    status,
    kind: 'auto',
    sourceKind: 'comment_run',
    sourceThreadIds: threadIds,
    mountId: LEDGER_MOUNT,
  });

type RowParams = {
  readonly agent: Agent;
  readonly stateWord: string;
  readonly dot?: 'running' | 'done' | 'stopped' | 'failed';
};

const rowOf = ({ agent, stateWord, dot = 'running' }: RowParams) => ({
  open: { kind: 'auto' as const, agentId: agent.id },
  title: `Run ${agent.name}`,
  stateWord,
  dot,
  isFinished: dot !== 'running',
});

describe('commentRunViewsOf gives every linked thread the run that works on it', () => {
  it('points every comment of one run to the same view, with the run word and the count', () => {
    const lead = leadOf({ id: 'header', ordinal: 0, threadIds: [HEADER_NOTE, LAYOUT_THREAD] });
    const views = commentRunViewsOf({
      agents: [lead],
      runs: [rowOf({ agent: lead, stateWord: 'Planning' })],
    });

    expect(views.get(HEADER_NOTE)).toEqual({
      agentId: lead.id,
      title: 'Run header',
      stateWord: 'Planning',
      dot: 'running',
      end: 'working',
      summary: null,
      mountId: lead.mountId,
      threadIds: [HEADER_NOTE, LAYOUT_THREAD],
    });
    expect(views.get(LAYOUT_THREAD)).toBe(views.get(HEADER_NOTE));
  });

  it('keeps two runs on one branch apart, each thread to its own run', () => {
    const header = leadOf({ id: 'header', ordinal: 0, threadIds: [HEADER_NOTE] });
    const imports = leadOf({ id: 'imports', ordinal: 1, threadIds: [IMPORT_THREAD] });
    const views = commentRunViewsOf({
      agents: [header, imports],
      runs: [
        rowOf({ agent: header, stateWord: 'Planning' }),
        rowOf({ agent: imports, stateWord: 'Working' }),
      ],
    });

    expect(views.get(HEADER_NOTE)?.agentId).toBe(header.id);
    expect(views.get(IMPORT_THREAD)?.agentId).toBe(imports.id);
    expect(views.has(FILTERS_NOTE)).toBe(false);
  });

  it('gives the threads of a stopped run back as stopped, and only those threads', () => {
    const stopped = leadOf({
      id: 'stopped',
      ordinal: 0,
      threadIds: [HEADER_NOTE, FILTERS_NOTE],
      status: 'stopped',
    });
    const working = leadOf({ id: 'working', ordinal: 1, threadIds: [LAYOUT_THREAD] });
    const views = commentRunViewsOf({
      agents: [stopped, working],
      runs: [
        rowOf({ agent: stopped, stateWord: 'Stopped', dot: 'stopped' }),
        rowOf({ agent: working, stateWord: 'Working' }),
      ],
    });

    expect(views.get(HEADER_NOTE)?.end).toBe('stopped');
    expect(views.get(FILTERS_NOTE)?.end).toBe('stopped');
    expect(views.get(LAYOUT_THREAD)).toMatchObject({ agentId: working.id, end: 'working' });
  });

  it('reads a run whose tree stopped as stopped even while the Lead row is not', () => {
    const lead = leadOf({ id: 'header', ordinal: 0, threadIds: [HEADER_NOTE] });
    const views = commentRunViewsOf({
      agents: [lead],
      runs: [rowOf({ agent: lead, stateWord: 'Stopped', dot: 'stopped' })],
    });

    expect(views.get(HEADER_NOTE)?.end).toBe('stopped');
  });

  it('keeps a thread in its newer working run when an older run on it stopped', () => {
    const older = leadOf({ id: 'older', ordinal: 0, threadIds: [HEADER_NOTE], status: 'stopped' });
    const newer = leadOf({ id: 'newer', ordinal: 1, threadIds: [HEADER_NOTE] });
    const views = commentRunViewsOf({
      agents: [older, newer],
      runs: [
        rowOf({ agent: older, stateWord: 'Stopped', dot: 'stopped' }),
        rowOf({ agent: newer, stateWord: 'Working' }),
      ],
    });

    expect(views.get(HEADER_NOTE)).toMatchObject({ agentId: newer.id, end: 'working' });
  });

  it('reads a Lead that completed as finished', () => {
    const lead = leadOf({
      id: 'header',
      ordinal: 0,
      threadIds: [HEADER_NOTE],
      status: 'completed',
    });
    const views = commentRunViewsOf({
      agents: [lead],
      runs: [rowOf({ agent: lead, stateWord: 'Resting' })],
    });

    expect(views.get(HEADER_NOTE)?.end).toBe('finished');
  });

  it('marks a finished run with the summary the Lead left', () => {
    const lead = {
      ...leadOf({ id: 'header', ordinal: 0, threadIds: [HEADER_NOTE, LAYOUT_THREAD] }),
      outputSummary: '  Moved the header into AppLayout.  ',
    };
    const views = commentRunViewsOf({
      agents: [lead],
      runs: [rowOf({ agent: lead, stateWord: 'Done', dot: 'done' })],
    });

    expect(views.get(HEADER_NOTE)).toMatchObject({
      end: 'finished',
      summary: 'Moved the header into AppLayout.',
    });
    expect(views.get(LAYOUT_THREAD)?.end).toBe('finished');
  });

  it('gives a thread in two runs only to the newest one', () => {
    const older = leadOf({
      id: 'older',
      ordinal: 0,
      threadIds: [HEADER_NOTE],
      status: 'completed',
    });
    const newer = leadOf({ id: 'newer', ordinal: 1, threadIds: [HEADER_NOTE, FILTERS_NOTE] });
    const views = commentRunViewsOf({
      agents: [older, newer],
      runs: [
        rowOf({ agent: older, stateWord: 'Done', dot: 'done' }),
        rowOf({ agent: newer, stateWord: 'Working' }),
      ],
    });

    expect(views.get(HEADER_NOTE)?.agentId).toBe(newer.id);
    expect(views.get(FILTERS_NOTE)?.agentId).toBe(newer.id);
  });
});
