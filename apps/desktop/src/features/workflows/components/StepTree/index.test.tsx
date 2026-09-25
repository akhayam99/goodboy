// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StepDraft } from '../../engine';
import { StepEditor } from './StepEditor';
import { StepRow } from './StepRow';
import { StepTree } from '.';

vi.mock('../../../../shared/components/RoutingPicker', () => ({
  RoutingPicker: ({ ariaLabel }: { readonly ariaLabel: string }) => (
    <div role="group" aria-label={ariaLabel} />
  ),
}));

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
  readonly onToggle?: () => void;
  readonly onMoveUp?: () => void;
};

const renderRow = ({
  isExpanded = false,
  isEdited = false,
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

const renderEditor = ({ polish, estimateNote, onRemove = vi.fn() }: EditorParams) =>
  render(
    <StepEditor
      step={step({ key: 's1', name: 'Review', role: 'reviewer', prompt: 'Check the diff' })}
      ordinal={2}
      stepCount={3}
      effort="medium"
      recommendedProvider="anthropic"
      recommendedModel="opus"
      connectedProviders={['anthropic']}
      isRoutingOverridden={false}
      disabled={false}
      onName={vi.fn()}
      onRole={vi.fn()}
      onPrompt={vi.fn()}
      onExpectedOutput={vi.fn()}
      onProvider={vi.fn()}
      onModel={vi.fn()}
      onEffort={vi.fn()}
      onVerbosity={vi.fn()}
      onRoutingReset={vi.fn()}
      onMoveUp={vi.fn()}
      onMoveDown={vi.fn()}
      onDuplicate={vi.fn()}
      onRemove={onRemove}
      onDone={vi.fn()}
      {...(polish !== undefined && { polish })}
      {...(estimateNote !== undefined && { estimateNote })}
    />,
  );

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
    expect(onAddStep).toHaveBeenCalledTimes(1);

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

  it('shows the editor when expanded and reorders from the grip with the arrow keys', () => {
    const onMoveUp = vi.fn();
    renderRow({ isExpanded: true, onMoveUp });

    expect(screen.getByText('Editor body')).toBeDefined();
    fireEvent.keyDown(screen.getByRole('button', { name: /Reorder step 1/ }), { key: 'ArrowUp' });
    expect(onMoveUp).toHaveBeenCalledTimes(1);
  });
});

describe('StepEditor', () => {
  it('leaves out Polish and the estimate when the host has none', () => {
    renderEditor({});

    expect(screen.queryByRole('button', { name: 'Polish step instruction' })).toBeNull();
    expect(screen.queryByTestId('plan-step-estimate')).toBeNull();
    expect(screen.getByRole('group', { name: 'Routing for step 2' })).toBeDefined();
  });

  it('polishes the instruction and shows the estimate when the host passes them', () => {
    const onPolish = vi.fn();
    renderEditor({ polish: { isPolishing: false, onPolish }, estimateNote: 'About 4 min' });

    fireEvent.click(screen.getByRole('button', { name: 'Polish step instruction' }));
    expect(onPolish).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('plan-step-estimate').textContent).toBe('About 4 min');
  });

  it('asks before removing the step', () => {
    const onRemove = vi.fn();
    renderEditor({ onRemove });

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove step' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
