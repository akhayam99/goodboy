// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import type { StepDraft } from '../../../engine';

vi.mock('../../StepTree/StepEditorFields', () => ({
  StepEditorFields: () => <div data-testid="step-fields" />,
}));

import { SavedStepEditor } from './SavedStepEditor';

const DRAFT = { name: 'Replay dead letters', provider: '', model: '' } as unknown as StepDraft;

type RenderParams = {
  readonly onRemove: () => void;
  readonly onDone: () => void;
};

const renderNew = ({ onRemove, onDone }: RenderParams) =>
  render(
    <SavedStepEditor
      mode="new"
      draft={DRAFT}
      recommendedProvider={'anthropic' as ProviderId}
      recommendedModel="sonnet-5"
      connectedProviders={[]}
      isBusy={false}
      error={null}
      onChange={vi.fn()}
      onSaveCopy={vi.fn()}
      onRemove={onRemove}
      onDone={onDone}
    />,
  );

afterEach(cleanup);

describe('SavedStepEditor', () => {
  it('ends a new step with discard and a primary save inline, and both still work', () => {
    const onRemove = vi.fn();
    const onDone = vi.fn();
    renderNew({ onRemove, onDone });

    const save = screen.getByRole('button', { name: 'Save step' });
    const discard = screen.getByRole('button', { name: 'Discard' });
    expect(save.closest('[data-slot="form-actions"]')).not.toBeNull();
    expect(discard.parentElement).toBe(save.parentElement);

    fireEvent.click(save);
    expect(onDone).toHaveBeenCalledOnce();
    fireEvent.click(discard);
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
