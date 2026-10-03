// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StepDraft } from '../../engine';
import { StepEditor } from './StepEditor';

vi.mock('../../../../shared/components/RoutingPicker', () => ({
  RoutingPicker: ({ ariaLabel }: { readonly ariaLabel: string }) => (
    <div role="group" aria-label={ariaLabel} />
  ),
}));

const STEP: StepDraft = {
  key: 's1',
  sourceStepId: null,
  libraryStepId: null,
  role: 'implementer',
  name: 'Build',
  prompt: 'Write it',
  expectedOutput: '',
  provider: '',
  model: '',
  effort: 'medium',
  verbosity: 'normal',
  size: null,
};

type EditorParams = {
  readonly ordinal: number;
  readonly stepCount: number;
  readonly roleSetLine?: string | null;
  readonly isRoutingOverridden?: boolean;
  readonly onMoveUp?: () => void;
  readonly onMoveDown?: () => void;
};

const renderEditor = ({
  ordinal,
  stepCount,
  roleSetLine = null,
  isRoutingOverridden = false,
  onMoveUp = vi.fn(),
  onMoveDown = vi.fn(),
}: EditorParams) =>
  render(
    <StepEditor
      step={STEP}
      ordinal={ordinal}
      stepCount={stepCount}
      effort="medium"
      recommendedProvider="anthropic"
      recommendedModel="opus"
      connectedProviders={['anthropic']}
      isRoutingOverridden={isRoutingOverridden}
      roleSetLine={roleSetLine}
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
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onDuplicate={vi.fn()}
      onRemove={vi.fn()}
      onDone={vi.fn()}
    />,
  );

const isDisabled = ({ name }: { readonly name: string }) =>
  screen.getByRole('button', { name }).hasAttribute('disabled');

afterEach(cleanup);

describe('StepEditor move buttons', () => {
  it('cannot move the first step up, but can move it down', () => {
    renderEditor({ ordinal: 1, stepCount: 3 });

    expect(isDisabled({ name: 'Move step up' })).toBe(true);
    expect(isDisabled({ name: 'Move step down' })).toBe(false);
  });

  it('cannot move the last step down, but can move it up', () => {
    renderEditor({ ordinal: 3, stepCount: 3 });

    expect(isDisabled({ name: 'Move step up' })).toBe(false);
    expect(isDisabled({ name: 'Move step down' })).toBe(true);
  });

  it('moves a middle step either way', () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    renderEditor({ ordinal: 2, stepCount: 3, onMoveUp, onMoveDown });

    fireEvent.click(screen.getByRole('button', { name: 'Move step up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move step down' }));

    expect(onMoveUp).toHaveBeenCalledTimes(1);
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it('disables both for a lone step', () => {
    renderEditor({ ordinal: 1, stepCount: 1 });

    expect(isDisabled({ name: 'Move step up' })).toBe(true);
    expect(isDisabled({ name: 'Move step down' })).toBe(true);
  });
});

describe('StepEditor role set line', () => {
  it('says the step follows its role set until a model is pinned', () => {
    renderEditor({ ordinal: 1, stepCount: 1, roleSetLine: 'Planning models · Opus 5.5' });

    expect(screen.getByText('Follows the role: Planning models · Opus 5.5').tagName).toBe('P');
  });

  it('drops the line once the step pins its own model', () => {
    renderEditor({
      ordinal: 1,
      stepCount: 1,
      roleSetLine: 'Planning models · Opus 5.5',
      isRoutingOverridden: true,
    });

    expect(screen.queryByText(/Follows the role/)).toBeNull();
  });
});
