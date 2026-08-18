// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import { runIdentity } from '../../../../timeline/runIdentity';
import type { RunWorkflowKind } from '../../../../timeline/runWorkflowKind';
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
};

const entryOf = ({
  kind = 'preset',
  name = 'Refactor (example)',
  goal = 'Restructure the legacy module',
  runId = 'run-7',
}: EntryParams = {}) =>
  ({
    kind: 'run',
    id: `run:${runId}`,
    at: '2026-08-18T09:00:00Z',
    run: { id: runId, goal },
    workflow: { name, origin: ORIGIN_OF[kind] },
    identity: runIdentity({ runId }),
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

    expect(className).toContain(runIdentity({ runId: 'run-7' }).chip);
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

  it('drops the title when the run carries no goal at all', () => {
    render(<TimelineRunLabel entry={entryOf({ goal: '   ' })} />);

    expect(screen.queryByText('Restructure the legacy module')).toBeNull();
    expect(screen.getByText('Refactor (example)')).toBeDefined();
  });
});
