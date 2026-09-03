import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useWorkflowDraft } from './useWorkflowDraft';

describe('useWorkflowDraft', () => {
  it('owns metadata and step actions', () => {
    const { result } = renderHook(() =>
      useWorkflowDraft({
        initial: {
          name: '',
          description: '',
          goal: '',
          steps: [],
          origin: 'custom',
          isPreset: false,
        },
      }),
    );
    act(() => result.current.updateMeta({ name: 'Workflow' }));
    act(() => result.current.addStep({}));
    const key = result.current.draft.steps[0]?.key;
    expect(key).toBeDefined();
    if (key === undefined) {
      return;
    }
    act(() => result.current.updateStep({ key, patch: { name: 'Review' } }));
    expect(result.current.draft.name).toBe('Workflow');
    expect(result.current.draft.steps[0]?.name).toBe('Review');
    act(() => result.current.removeStep({ key }));
    expect(result.current.draft.steps).toEqual([]);
  });
});
