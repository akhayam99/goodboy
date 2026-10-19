import { describe, expect, it } from 'vitest';
import type { Agent, Workflow, WorkflowRun } from '@goodboy/types';
import { launchesOf } from './launchesOf';

const workflow: Workflow = JSON.parse(JSON.stringify({ id: 'workflow-ship', name: 'Ship a fix' }));

type RunParams = {
  readonly id: string;
  readonly createdAt: string;
  readonly mode?: 'static' | 'dynamic';
  readonly discardedAt?: string;
};

const runOf = ({ id, createdAt, mode = 'static', discardedAt }: RunParams): WorkflowRun =>
  JSON.parse(
    JSON.stringify({
      id,
      createdAt,
      executionMode: mode,
      ...(discardedAt !== undefined && { discardedAt }),
    }),
  );

type RootParams = {
  readonly id: string;
  readonly startedAt: string;
};

const rootOf = ({ id, startedAt }: RootParams): Agent =>
  JSON.parse(JSON.stringify({ id, startedAt }));

describe('launchesOf', () => {
  it('lists runs and Auto roots newest first', () => {
    const launches = launchesOf({
      attached: [
        { run: runOf({ id: 'run-old', createdAt: '2026-10-18T08:00:00.000Z' }), workflow },
        { run: runOf({ id: 'run-new', createdAt: '2026-10-19T09:00:00.000Z' }), workflow },
      ],
      roots: [rootOf({ id: 'auto-mid', startedAt: '2026-10-19T08:00:00.000Z' })],
    });

    expect(launches.map((launch) => launch.id)).toEqual([
      'run:run-new',
      'auto:auto-mid',
      'run:run-old',
    ]);
  });

  it('leaves out archived runs and orchestrated runs', () => {
    const launches = launchesOf({
      attached: [
        {
          run: runOf({
            id: 'run-archived',
            createdAt: '2026-10-19T09:00:00.000Z',
            discardedAt: '2026-10-19T10:00:00.000Z',
          }),
          workflow,
        },
        {
          run: runOf({
            id: 'run-orchestrated',
            createdAt: '2026-10-19T09:00:00.000Z',
            mode: 'dynamic',
          }),
          workflow,
        },
      ],
      roots: [],
    });

    expect(launches).toEqual([]);
  });
});
