import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkflowDraft } from '../../../engine';
import { WORKFLOW_AUTOSAVE_DELAY_MS, useWorkflowAutosave } from './index';

const draft = (name: string): WorkflowDraft =>
  ({ name, description: '', steps: [{ name: 'Plan' }] }) as unknown as WorkflowDraft;

type HookProps = {
  readonly form: WorkflowDraft;
  readonly flush: () => Promise<boolean>;
  readonly isEditing?: boolean;
};

const savedForm = { current: null as string | null };

const renderAutosave = ({ form, flush, isEditing = true }: HookProps) =>
  renderHook<void, HookProps>(
    (props) =>
      useWorkflowAutosave({
        form: props.form,
        flush: props.flush,
        isEditing: props.isEditing ?? true,
        savedForm,
      }),
    { initialProps: { form, flush, isEditing } satisfies HookProps },
  );

beforeEach(() => {
  vi.useFakeTimers();
  savedForm.current = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useWorkflowAutosave', () => {
  it('saves through the flush of the latest render, never a stale one', () => {
    const first = vi.fn(async () => true);
    const latest = vi.fn(async () => true);
    const form = draft('Release');
    const { rerender } = renderAutosave({ form, flush: first });

    vi.advanceTimersByTime(WORKFLOW_AUTOSAVE_DELAY_MS / 2);
    rerender({ form, flush: latest });
    vi.advanceTimersByTime(WORKFLOW_AUTOSAVE_DELAY_MS);

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it('waits for the typing to settle before it saves once', () => {
    const flush = vi.fn(async () => true);
    const { rerender } = renderAutosave({ form: draft('R'), flush });

    vi.advanceTimersByTime(WORKFLOW_AUTOSAVE_DELAY_MS - 100);
    rerender({ form: draft('Re'), flush });
    vi.advanceTimersByTime(WORKFLOW_AUTOSAVE_DELAY_MS - 100);
    expect(flush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('skips a form that matches the saved copy, has no name, or is not being edited', () => {
    const flush = vi.fn(async () => true);
    const saved = draft('Release');
    savedForm.current = JSON.stringify(saved);
    const { rerender } = renderAutosave({ form: saved, flush });
    rerender({ form: draft('  '), flush });
    rerender({ form: draft('Hotfix'), flush, isEditing: false });

    vi.advanceTimersByTime(WORKFLOW_AUTOSAVE_DELAY_MS * 2);

    expect(flush).not.toHaveBeenCalled();
  });
});
