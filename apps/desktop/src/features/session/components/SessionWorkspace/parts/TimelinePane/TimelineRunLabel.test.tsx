// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { WorkflowRun } from '@goodboy/types';
import { resolveOrchestratorState } from '../../../../../workflows/components/OrchestratorStrip/orchestratorState';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import { runIdentity } from '../../../../timeline/runIdentity';
import type { RunWorkflowKind } from '../../../../timeline/runWorkflowKind';
import { ORCHESTRATOR_DECIDING_SENTENCE } from '../../../../../workflows/orchestratorCopy';
import { resolveRunRowState } from '../../../../../workTreeModel/rowState';
import { runOpenQuestion } from '../../../../timeline/runOpenQuestion';
import { TimelineRowStateLine } from './TimelineRowStateLine';
import { TimelineRunLabel } from './TimelineRunLabel';

afterEach(cleanup);

type LabelProps = {
  readonly entry: TimelineRunEntry;
  readonly isDeciding?: boolean;
};

const Label = ({ entry, isDeciding = false }: LabelProps) => (
  <>
    <TimelineRunLabel entry={entry} />
    <TimelineRowStateLine
      state={resolveRunRowState({
        run: entry.run,
        advance: null,
        isFinished: false,
        isDeciding,
        hasRunningStep: false,
        failedStep: null,
        question: runOpenQuestion({ entry }),
        readyStep: null,
        chainedAfterTitle: null,
      })}
    />
  </>
);

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
  readonly title?: string;
  readonly discardedAt?: string | null;
  readonly children?: ReadonlyArray<unknown>;
};

const entryOf = ({
  kind = 'preset',
  name = 'Refactor (example)',
  goal = 'Restructure the legacy module',
  runId = 'run-7',
  title,
  discardedAt = null,
  children = [],
}: EntryParams = {}) =>
  ({
    kind: 'run',
    id: `run:${runId}`,
    at: '2026-08-18T09:00:00Z',
    run: { id: runId, goal, discardedAt, ...(title !== undefined && { title }) },
    workflow: { name, origin: ORIGIN_OF[kind] },
    identity: runIdentity({ laneIndex: 0, seed: 0 }),
    children,
    producedPlan: null,
  }) as unknown as TimelineRunEntry;

type StepParams = {
  readonly stepLabel: string;
  readonly questionAt?: string | null;
  readonly children?: ReadonlyArray<unknown>;
};

const stepOf = ({ stepLabel, questionAt = null, children = [] }: StepParams) => ({
  kind: 'agent',
  stepLabel,
  openQuestions: questionAt == null ? [] : [{ id: `question-${stepLabel}`, createdAt: questionAt }],
  children,
});

const chipOf = () => {
  const chip = screen.getByTitle(`Refactor (example) ${LABEL_OF.preset.toLowerCase()}`);
  return chip;
};

describe('TimelineRunLabel', () => {
  it('spends no word on the run kind, the glyph says it', () => {
    const { container } = render(<Label entry={entryOf()} />);

    expect(chipOf().textContent).toBe('');
    expect(screen.queryByText('Workflow')).toBeNull();
    expect(container.textContent).toBe('Refactor (example)');
  });

  it('keeps the glyph neutral, never tinted by a tone or by the lane identity', () => {
    render(<Label entry={entryOf()} />);
    const { className } = chipOf();

    expect(className).toContain('text-muted-foreground');
    expect(className).not.toContain('identity-');
    for (const tone of ['primary', 'success', 'danger', 'warning', 'info']) {
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
      const { container } = render(<Label entry={entryOf({ kind })} />);
      const icon = container.querySelector('svg');
      expect(screen.getByRole('img', { name: new RegExp(LABEL_OF[kind], 'i') })).toBeDefined();
      drawn.set(kind, icon?.innerHTML ?? '');
      cleanup();
    }

    expect(new Set(drawn.values()).size).toBe(3);
  });

  it('prints the run name as plain text and never the raw goal', () => {
    render(<Label entry={entryOf({ name: 'Orchestrated workflow 13' })} />);

    expect(screen.getByText('Orchestrated workflow 13').tagName).toBe('SPAN');
    expect(screen.queryByText('Restructure the legacy module')).toBeNull();
  });

  it('keeps a long goal full of pasted output out of the row', () => {
    const goal = `Ecco il prompt di goal rivisto: \`\`\`${'Valuta se '.repeat(400)}\`\`\``;
    const { container } = render(<Label entry={entryOf({ name: 'Checkout', goal })} />);

    expect(container.textContent).not.toContain('Ecco il prompt');
    expect(screen.getByText('Checkout').className).toContain('truncate');
  });

  it('prints the generated run title and keeps the preset name in the chip tooltip', () => {
    render(<Label entry={entryOf({ name: 'Feature', title: 'Fix Safari OAuth login loop' })} />);

    expect(screen.getByText('Fix Safari OAuth login loop').className).toContain('truncate');
    expect(screen.queryByText('Feature')).toBeNull();
    expect(screen.getByTitle('Feature preset workflow')).toBeDefined();
  });

  it('names a preset in the chip tooltip and leaves the row to the title', () => {
    render(<Label entry={entryOf({ name: 'Feature' })} />);

    expect(screen.getByTitle('Feature preset workflow')).toBeDefined();
  });

  it('keeps the plain kind in the tooltip of an orchestrated run', () => {
    render(<Label entry={entryOf({ kind: 'orchestrator', name: 'Fix login' })} />);

    expect(screen.getByTitle(LABEL_OF.orchestrator)).toBeDefined();
  });

  it('says which step needs an answer when one of its steps asks', () => {
    render(
      <Label
        entry={entryOf({
          children: [
            stepOf({ stepLabel: '3' }),
            stepOf({ stepLabel: '2', questionAt: '2026-08-18T09:30:00Z' }),
          ],
        })}
      />,
    );

    const state = screen.getByTestId('timeline-row-state');
    expect(state.className).toContain('text-warning');
    expect(state.getAttribute('title')).toBe('Needs your answer in step 2');
    expect(screen.getByText('Needs your answer in step 2').className).toContain('sr-only');
    expect(screen.getByText('Needs you').getAttribute('aria-hidden')).toBe('true');
  });

  it('names the step of the oldest open question, nested steps included', () => {
    render(
      <Label
        entry={entryOf({
          children: [
            stepOf({ stepLabel: '5', questionAt: '2026-08-18T11:00:00Z' }),
            stepOf({
              stepLabel: '4',
              children: [stepOf({ stepLabel: '4.2', questionAt: '2026-08-18T10:00:00Z' })],
            }),
          ],
        })}
      />,
    );

    expect(screen.getByText('Needs your answer in step 4.2')).toBeDefined();
  });

  it('stays quiet about answers when no step asks anything', () => {
    render(<Label entry={entryOf({ children: [stepOf({ stepLabel: '1' })] })} />);

    expect(screen.queryByText(/Needs your answer/)).toBeNull();
  });

  it('keeps a live run at full-strength label ink and a tinted glyph', () => {
    render(<Label entry={entryOf()} />);

    expect(screen.getByText('Refactor (example)').className).toContain('text-foreground');
    expect(chipOf().className).toContain('bg-current/12');
  });

  it('keeps the chip neutral while one of its steps waits on an answer', () => {
    render(
      <Label
        entry={entryOf({
          children: [stepOf({ stepLabel: '1', questionAt: '2026-08-18T09:30:00Z' })],
        })}
      />,
    );

    expect(chipOf().className).not.toContain('warning');
    expect(chipOf().className).not.toContain('identity-');
  });

  it('reads a discarded run in the muted register the discard event next to it uses', () => {
    render(<Label entry={entryOf({ discardedAt: '2026-08-18T10:00:00Z' })} />);

    const name = screen.getByText('Refactor (example)');

    expect(name.className).toContain('text-muted-foreground');
    expect(name.className).not.toContain('text-foreground');
  });

  it('fades the glyph of a discarded run without spending a word on it', () => {
    render(<Label entry={entryOf({ discardedAt: '2026-08-18T10:00:00Z' })} />);

    expect(chipOf().className).toContain('text-faint-foreground');
    expect(chipOf().className).not.toContain('text-muted-foreground');
    expect(screen.queryByText('Discarded')).toBeNull();
  });

  it('says what the orchestrator is doing while it chooses the next step', () => {
    render(<Label entry={entryOf({ kind: 'orchestrator' })} isDeciding />);
    expect(screen.getByText(ORCHESTRATOR_DECIDING_SENTENCE)).toBeDefined();
    expect(screen.getByTestId('timeline-row-state').className).toContain('text-muted-foreground');
    expect(screen.getByText('Refactor (example)')).toBeDefined();
  });

  it('words the deciding row exactly as the orchestrator panel words it', () => {
    render(<Label entry={entryOf({ kind: 'orchestrator' })} isDeciding />);

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
    render(<Label entry={entryOf({ kind: 'orchestrator' })} />);

    expect(screen.queryByText(ORCHESTRATOR_DECIDING_SENTENCE)).toBeNull();
  });

  it('shows the run name when the run carries no goal at all', () => {
    render(<Label entry={entryOf({ goal: '   ' })} />);

    expect(screen.getByText('Refactor (example)')).toBeDefined();
  });
});
