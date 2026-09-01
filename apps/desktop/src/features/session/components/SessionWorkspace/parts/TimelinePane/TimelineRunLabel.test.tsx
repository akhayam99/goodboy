// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { WorkflowRun } from '@goodboy/types';
import { resolveOrchestratorState } from '../../../../../workflows/components/OrchestratorPanel/orchestratorState';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import { runIdentity } from '../../../../timeline/runIdentity';
import type { RunWorkflowKind } from '../../../../timeline/runWorkflowKind';
import { ORCHESTRATOR_DECIDING_SENTENCE } from '../../../../../workflows/orchestratorCopy';
import { TimelineRunLabel } from './TimelineRunLabel';

afterEach(cleanup);

const ORIGIN_OF: Record<RunWorkflowKind, string> = {
  preset: 'library',
  custom: 'custom',
  orchestrator: 'orchestrated',
};

const LABEL_OF: Record<RunWorkflowKind, string> = {
  preset: 'Preset workflow',
  custom: 'Custom workflow',
  orchestrator: 'Orchestrated workflow',
};

type EntryParams = {
  readonly kind?: RunWorkflowKind;
  readonly name?: string;
  readonly goal?: string;
  readonly runId?: string;
  readonly discardedAt?: string | null;
};

const entryOf = ({
  kind = 'preset',
  name = 'Refactor (example)',
  goal = 'Restructure the legacy module',
  runId = 'run-7',
  discardedAt = null,
}: EntryParams = {}) =>
  ({
    kind: 'run',
    id: `run:${runId}`,
    at: '2026-08-18T09:00:00Z',
    run: { id: runId, goal, discardedAt },
    workflow: { name, origin: ORIGIN_OF[kind] },
    identity: runIdentity({ laneIndex: 0, seed: 0 }),
    children: [],
    producedPlan: null,
  }) as unknown as TimelineRunEntry;

const chipOf = () => {
  const chip = screen.getByTitle(LABEL_OF.preset);
  return chip;
};

describe('TimelineRunLabel', () => {
  it('says the generic word Workflow instead of the run name in the chip', () => {
    render(<TimelineRunLabel entry={entryOf()} />);

    expect(chipOf().textContent).toContain('Workflow');
    expect(chipOf().textContent).not.toContain('Refactor (example)');
  });

  it('tints the chip from the identity palette and never from a semantic tone', () => {
    render(<TimelineRunLabel entry={entryOf()} />);
    const { className } = chipOf();

    expect(className).toContain(runIdentity({ laneIndex: 0, seed: 0 }).chip);
    for (const tone of ['primary', 'accent', 'success', 'danger', 'warning', 'info']) {
      expect(className).not.toContain(`bg-${tone}`);
      expect(className).not.toContain(`text-${tone}`);
    }
  });

  it('carries the kind in the icon, with one distinct glyph per kind', () => {
    const drawn = new Map<RunWorkflowKind, string>();
    for (const kind of [
      'preset',
      'custom',
      'orchestrator',
    ] satisfies ReadonlyArray<RunWorkflowKind>) {
      const { container } = render(<TimelineRunLabel entry={entryOf({ kind })} />);
      const icon = container.querySelector('svg');
      expect(screen.getByLabelText(LABEL_OF[kind])).toBeDefined();
      drawn.set(kind, icon?.innerHTML ?? '');
      cleanup();
    }

    expect(new Set(drawn.values()).size).toBe(3);
  });

  it('prints the run name as plain text and the goal after it', () => {
    render(<TimelineRunLabel entry={entryOf({ name: 'Orchestrated workflow 13' })} />);

    expect(screen.getByText('Orchestrated workflow 13').tagName).toBe('SPAN');
    expect(screen.getByText('Restructure the legacy module')).toBeDefined();
  });

  it('drops the title when the goal only repeats the name', () => {
    render(<TimelineRunLabel entry={entryOf({ name: 'Ship it', goal: 'Ship it' })} />);

    expect(screen.getAllByText('Ship it')).toHaveLength(1);
  });

  it('keeps a live run at full-strength label ink and a filled chip', () => {
    render(<TimelineRunLabel entry={entryOf()} />);

    expect(screen.getByText('Refactor (example)').className).toContain('text-foreground');
    expect(chipOf().className).toContain(runIdentity({ laneIndex: 0, seed: 0 }).chip);
  });

  it('reads a discarded run in the muted register the discard event next to it uses', () => {
    render(<TimelineRunLabel entry={entryOf({ discardedAt: '2026-08-18T10:00:00Z' })} />);

    const name = screen.getByText('Refactor (example)');

    expect(name.className).toContain('text-muted-foreground');
    expect(name.className).not.toContain('text-foreground');
  });

  it('hollows the chip of a discarded run without spending a word on it', () => {
    render(<TimelineRunLabel entry={entryOf({ discardedAt: '2026-08-18T10:00:00Z' })} />);

    expect(chipOf().className).toContain(runIdentity({ laneIndex: 0, seed: 0 }).mutedChip);
    expect(chipOf().className).not.toContain(runIdentity({ laneIndex: 0, seed: 0 }).chip);
    expect(screen.queryByText('Discarded')).toBeNull();
  });

  it('keeps the run identity hue on a discarded run so it stays that run', () => {
    const { mutedChip } = runIdentity({ laneIndex: 0, seed: 0 });

    render(<TimelineRunLabel entry={entryOf({ discardedAt: '2026-08-18T10:00:00Z' })} />);

    expect(mutedChip).toContain('text-run-');
    expect(chipOf().className).toContain(mutedChip);
  });

  it('says what the orchestrator is doing while it chooses the next step', () => {
    render(<TimelineRunLabel entry={entryOf({ kind: 'orchestrator' })} isDeciding />);
    const sentence = screen.getByText(ORCHESTRATOR_DECIDING_SENTENCE);

    expect(sentence.className).toContain('text-muted-foreground');
    expect(screen.getByText('Refactor (example)')).toBeDefined();
  });

  it('words the deciding row exactly as the orchestrator panel words it', () => {
    render(<TimelineRunLabel entry={entryOf({ kind: 'orchestrator' })} isDeciding />);

    expect(
      resolveOrchestratorState({
        run: { autoRun: true } as unknown as WorkflowRun,
        agents: [],
        isOrchestrating: true,
        hasOpenQuestions: false,
        costUsd: 0,
      }).sentence,
    ).toBe(screen.getByText(ORCHESTRATOR_DECIDING_SENTENCE).textContent);
  });

  it('stays silent about the orchestrator when no decision is in flight', () => {
    render(<TimelineRunLabel entry={entryOf({ kind: 'orchestrator' })} />);

    expect(screen.queryByText(ORCHESTRATOR_DECIDING_SENTENCE)).toBeNull();
  });

  it('drops the title when the run carries no goal at all', () => {
    render(<TimelineRunLabel entry={entryOf({ goal: '   ' })} />);

    expect(screen.queryByText('Restructure the legacy module')).toBeNull();
    expect(screen.getByText('Refactor (example)')).toBeDefined();
  });
});
