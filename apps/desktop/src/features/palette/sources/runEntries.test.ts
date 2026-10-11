// @vitest-environment node
import { Inbox } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { aWorkflowRun } from '@goodboy/types/testing';
import type { WorkflowRunFacts } from '../../actions/kinds/workflowRun';
import type { PaletteEntry } from '../types';
import { pickRun, runRow, runSection } from './runEntries';

const SESSION = 'session-payout' as SessionId;

const facts = (
  id: string,
  state: WorkflowRunFacts['state'],
  overrides: Partial<WorkflowRunFacts> = {},
): WorkflowRunFacts => ({
  run: aWorkflowRun({ id: id as WorkflowRunId }),
  sessionId: SESSION,
  name: `Run ${id}`,
  state,
  isClosable: false,
  openQuestionId: null,
  stoppedAgentId: null,
  readyAgentId: null,
  readyStepName: null,
  hasChanges: false,
  canPause: false,
  hasStepRouting: false,
  summary: '',
  ...overrides,
});

const entry = (key: string, label: string): PaletteEntry => ({
  key,
  label,
  kind: 'verb',
  group: null,
  icon: Inbox,
  run: vi.fn(),
});

describe('pickRun', () => {
  it('prefers the run on screen', () => {
    const picked = pickRun({
      candidates: [facts('a', 'failed'), facts('b', 'done')],
      focusedRunId: 'b',
    });

    expect(picked?.run.id).toBe('b');
  });

  it('otherwise takes the run that needs you, then a running one, then the rest', () => {
    const states = (...list: ReadonlyArray<WorkflowRunFacts['state']>) =>
      pickRun({
        candidates: list.map((state, index) => facts(String(index), state)),
        focusedRunId: null,
      })?.state;

    expect(states('done', 'running', 'failed')).toBe('failed');
    expect(states('done', 'running', 'queued')).toBe('running');
    expect(states('done', 'queued')).toBe('queued');
    expect(states('done')).toBe('done');
  });

  it('never picks an archived run, and has nothing without runs', () => {
    expect(pickRun({ candidates: [facts('a', 'discarded')], focusedRunId: 'a' })).toBeNull();
    expect(pickRun({ candidates: [], focusedRunId: null })).toBeNull();
  });
});

describe('runRow', () => {
  it('names the run, its state and the step that is next', () => {
    const open = vi.fn();
    const row = runRow({ facts: facts('a', 'paused', { readyStepName: 'Implement' }), open });

    expect([row.key, row.label, row.tag, row.detail]).toEqual([
      'run:a',
      'Run a',
      'Paused',
      'Next: Implement',
    ]);
    row.run();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('says Needs you for a run that stopped on a failed step', () => {
    expect(runRow({ facts: facts('a', 'failed'), open: vi.fn() }).tag).toBe('Needs you');
  });
});

describe('runSection', () => {
  const verb = (id: string, label: string): PaletteEntry => ({
    ...entry(`verb:${id}`, label),
    action: { id } as PaletteEntry['action'],
  });

  it('lists the run, its verbs in state order, Start a run and Open Runs', () => {
    const rows = runSection({
      row: entry('run:a', 'Ship a fix'),
      verbs: [verb('workflowRun.close', 'Stop run'), verb('workflowRun.continue', 'Continue step')],
      startRun: entry('level:start-run', 'Start a run'),
      openRuns: entry('lens:workflows', 'Open Runs'),
    });

    expect(rows.map((row) => row.label)).toEqual([
      'Ship a fix',
      'Continue step',
      'Stop run',
      'Start a run',
      'Open Runs',
    ]);
  });

  it('leaves out what a session without a run has no use for', () => {
    expect(
      runSection({
        row: null,
        verbs: [],
        startRun: entry('level:start-run', 'Start a run'),
        openRuns: null,
      }).map((row) => row.label),
    ).toEqual(['Start a run']);
  });
});
