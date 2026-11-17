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
  readonly isFinished?: boolean;
};

const rowOf = ({ agent, stateWord, isFinished = false }: RowParams) => ({
  open: { kind: 'auto' as const, agentId: agent.id },
  title: `Run ${agent.name}`,
  stateWord,
  dot: isFinished ? ('done' as const) : ('running' as const),
  isFinished,
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
      isFinished: false,
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

  it('frees only the threads of a stopped run', () => {
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
        rowOf({ agent: stopped, stateWord: 'Stopped', isFinished: true }),
        rowOf({ agent: working, stateWord: 'Working' }),
      ],
    });

    expect(views.has(HEADER_NOTE)).toBe(false);
    expect(views.has(FILTERS_NOTE)).toBe(false);
    expect(views.get(LAYOUT_THREAD)?.agentId).toBe(working.id);
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
        rowOf({ agent: older, stateWord: 'Done', isFinished: true }),
        rowOf({ agent: newer, stateWord: 'Working' }),
      ],
    });

    expect(views.get(HEADER_NOTE)?.agentId).toBe(newer.id);
    expect(views.get(FILTERS_NOTE)?.agentId).toBe(newer.id);
  });
});
