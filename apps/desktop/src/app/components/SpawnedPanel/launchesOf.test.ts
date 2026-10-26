import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type Workflow,
  type WorkflowRun,
  type WorkflowRunId,
} from '@goodboy/types';
import type { SessionRun } from '../../../features/session/sessionRunsOf';
import { launchesOf } from './launchesOf';

const workflow: Workflow = JSON.parse(JSON.stringify({ id: 'workflow-ship', name: 'Ship a fix' }));

type IdParams = {
  readonly id: string;
};

const openRun = ({ id }: IdParams): SessionRun['open'] => ({
  kind: 'run',
  runId: brandId<WorkflowRunId>({ value: id }),
});

const openAgent = ({ id }: IdParams): SessionRun['open'] => ({
  kind: 'agent',
  agentId: brandId<AgentId>({ value: id }),
});

const openAuto = ({ id }: IdParams): SessionRun['open'] => ({
  kind: 'auto',
  agentId: brandId<AgentId>({ value: id }),
});

type EntryParams = {
  readonly open: SessionRun['open'];
  readonly startedAt: number;
  readonly isFinished?: boolean;
  readonly isArchived?: boolean;
};

const entryOf = ({
  open,
  startedAt,
  isFinished = false,
  isArchived = false,
}: EntryParams): SessionRun =>
  JSON.parse(JSON.stringify({ id: JSON.stringify(open), open, startedAt, isFinished, isArchived }));

const runOf = ({ id }: { readonly id: string }): WorkflowRun => JSON.parse(JSON.stringify({ id }));

const attachedOf = ({ id }: { readonly id: string }) => ({ run: runOf({ id }), workflow });

const idsOf = (launches: ReturnType<typeof launchesOf>) => launches.map((launch) => launch.id);

describe('launchesOf', () => {
  it('lists runs, Auto roots and loose agents newest first', () => {
    const launches = launchesOf({
      runs: [
        entryOf({ open: openRun({ id: 'run-old' }), startedAt: 1 }),
        entryOf({ open: openAgent({ id: 'agent-loose' }), startedAt: 4 }),
        entryOf({ open: openAuto({ id: 'auto-mid' }), startedAt: 3 }),
        entryOf({ open: openRun({ id: 'run-new' }), startedAt: 5 }),
      ],
      attached: [attachedOf({ id: 'run-old' }), attachedOf({ id: 'run-new' })],
    });

    expect(idsOf(launches)).toEqual([
      'run:run-new',
      'agent:agent-loose',
      'auto:auto-mid',
      'run:run-old',
    ]);
  });

  it('keeps an orchestrated run, which is a run like any other', () => {
    const launches = launchesOf({
      runs: [entryOf({ open: openRun({ id: 'run-plan' }), startedAt: 2 })],
      attached: [attachedOf({ id: 'run-plan' })],
    });

    expect(idsOf(launches)).toEqual(['run:run-plan']);
  });

  it('leaves out archived runs and runs that are no longer attached', () => {
    const launches = launchesOf({
      runs: [
        entryOf({
          open: openRun({ id: 'run-archived' }),
          startedAt: 2,
          isArchived: true,
        }),
        entryOf({ open: openRun({ id: 'run-gone' }), startedAt: 3 }),
      ],
      attached: [attachedOf({ id: 'run-archived' })],
    });

    expect(launches).toEqual([]);
  });

  it('shows the 30 newest finished launches and every one still in progress', () => {
    const finished = Array.from({ length: 33 }, (_, index) =>
      entryOf({
        open: openAgent({ id: `agent-done-${index}` }),
        startedAt: 100 + index,
        isFinished: true,
      }),
    );
    const live = entryOf({
      open: openAgent({ id: 'agent-live' }),
      startedAt: 1,
    });

    const ids = idsOf(launchesOf({ runs: [...finished, live], attached: [] }));

    expect(ids).toHaveLength(31);
    expect(ids).toContain('agent:agent-live');
    expect(ids).toContain('agent:agent-done-32');
    expect(ids).not.toContain('agent:agent-done-2');
  });
});
