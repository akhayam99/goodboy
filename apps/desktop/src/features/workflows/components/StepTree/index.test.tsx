// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StepDraft } from '../../engine';
import { savedStepGroups } from '../../savedSteps';
import { StepRow } from './StepRow';
import { StepTree } from '.';

type StepParams = {
  readonly key: string;
  readonly name: string;
  readonly role?: StepDraft['role'];
  readonly prompt?: string;
};

const step = ({ key, name, role = 'implementer', prompt = '' }: StepParams): StepDraft => ({
  key,
  sourceStepId: null,
  libraryStepId: null,
  role,
  name,
  prompt,
  expectedOutput: '',
  provider: '',
  model: '',
  effort: 'medium',
  verbosity: 'normal',
  size: null,
});

type TreeParams = {
  readonly steps: ReadonlyArray<StepDraft>;
  readonly isPlanning?: boolean;
  readonly isDragging?: boolean;
  readonly dropIndex?: number | null;
  readonly disabled?: boolean;
  readonly onAddStep?: () => void;
};

const renderTree = ({
  steps,
  isPlanning = false,
  isDragging = false,
  dropIndex = null,
  disabled = false,
  onAddStep = vi.fn(),
}: TreeParams) =>
  render(
    <StepTree
      steps={steps}
      editedCount={1}
      identityIndex={0}
      isPlanning={isPlanning}
      isDragging={isDragging}
      dropIndex={dropIndex}
      disabled={disabled}
      savedSteps={savedStepGroups({ defs: [] })}
      onAddStep={onAddStep}
      renderStep={({ step: slotStep, index, span }) => (
        <li key={slotStep.key} data-span={span}>
          {`${index + 1}. ${slotStep.name}`}
        </li>
      )}
    />,
  );

type RowParams = {
  readonly isExpanded?: boolean;
  readonly isEdited?: boolean;
  readonly isPinned?: boolean;
  readonly onToggle?: () => void;
  readonly onMoveUp?: () => void;
};

const renderRow = ({
  isExpanded = false,
  isEdited = false,
  isPinned = false,
  onToggle = vi.fn(),
  onMoveUp = vi.fn(),
}: RowParams) =>
  render(
    <ol>
      <StepRow
        step={step({ key: 's1', name: 'Wire the ledger-core refunds' })}
        ordinal={1}
        kind="implementer"
        provider="anthropic"
        model="opus"
        effort="medium"
        estimate={undefined}
        span="origin"
        identityIndex={0}
        isExpanded={isExpanded}
        isEdited={isEdited}
        isPinned={isPinned}
        isDragging={false}
        disabled={false}
        editor={<p>Editor body</p>}
        onToggle={onToggle}
        onStartDrag={vi.fn()}
        onMoveUp={onMoveUp}
        onMoveDown={vi.fn()}
      />
    </ol>,
  );

type EditorParams = {
  readonly polish?: { readonly isPolishing: boolean; readonly onPolish: () => void };
  readonly estimateNote?: string | null;
  readonly onRemove?: () => void;
};

afterEach(cleanup);

describe('StepTree', () => {
  it('lists every step in order with its lane span, the count and the edits', () => {
    renderTree({
      steps: [step({ key: 'a', name: 'Scout' }), step({ key: 'b', name: 'Build' })],
    });

    const list = screen.getByRole('list', { name: 'Workflow steps' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['1. Scout', '2. Build', 'Add step']);
    expect(items[0]?.getAttribute('data-span')).toBe('origin');
    expect(items[1]?.getAttribute('data-span')).toBe('through');
    expect(screen.getByText('2 steps')).toBeDefined();
    expect(screen.getByText('· 1 edited')).toBeDefined();
  });

  it('adds a step from the add row, unless the tree is disabled', () => {
    const onAddStep = vi.fn();
    renderTree({ steps: [], onAddStep });
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
    fireEvent.click(screen.getByRole('option', { name: /Blank step/ }));
    expect(onAddStep).toHaveBeenCalledWith(null);

    cleanup();
    renderTree({ steps: [], disabled: true });
    expect(screen.getByRole('button', { name: 'Add step' }).hasAttribute('disabled')).toBe(true);
  });

  it('shows a skeleton while a plan is drafted from nothing', () => {
    renderTree({ steps: [], isPlanning: true });

    expect(screen.queryByRole('list', { name: 'Workflow steps' })).toBeNull();
  });

  it('opens a drop zone between every step while dragging', () => {
    const { container } = renderTree({
      steps: [step({ key: 'a', name: 'Scout' }), step({ key: 'b', name: 'Build' })],
      isDragging: true,
      dropIndex: 1,
    });

    const zones = [...container.querySelectorAll('[data-dropindex]')];
    expect(zones.map((zone) => zone.getAttribute('data-dropindex'))).toEqual(['0', '1', '2']);
  });
});

describe('StepRow', () => {
  it('toggles its editor from the title and marks an edited step', () => {
    const onToggle = vi.fn();
    renderRow({ isEdited: true, onToggle });

    const title = screen.getByRole('button', { name: 'Step 1: Wire the ledger-core refunds' });
    expect(title.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('Edited')).toBeDefined();
    expect(screen.queryByText('Editor body')).toBeNull();

    fireEvent.click(title);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('marks a pinned model with the same dot as an edit, and a follow step with none', () => {
    renderRow({ isPinned: true });
    screen.getByText('Pinned model');

    cleanup();
    renderRow({});
    expect(screen.queryByText('Pinned model')).toBeNull();
  });

  it('shows the editor when expanded and reorders from the grip with the arrow keys', () => {
    const onMoveUp = vi.fn();
    renderRow({ isExpanded: true, onMoveUp });

    expect(screen.getByText('Editor body')).toBeDefined();
    fireEvent.keyDown(screen.getByRole('button', { name: /Reorder step 1/ }), { key: 'ArrowUp' });
    expect(onMoveUp).toHaveBeenCalledTimes(1);
  });
});
