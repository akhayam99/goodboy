// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { chatModelId } from '../../../chatRouting';
import { useRoutingDraft } from './index';

const CLAUDE = { provider: 'anthropic', model: 'sonnet-5', effort: null } as const;

describe('useRoutingDraft', () => {
  it('folds a provider, model and effort pick from one gesture into one commit', async () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useRoutingDraft({ routing: CLAUDE, onCommit }));
    const codexId = chatModelId({ provider: 'codex', model: 'gpt-5.6-sol' });

    await act(async () => {
      result.current.setProvider('codex');
      result.current.setModelId(codexId);
      result.current.setEffort('high');
      await Promise.resolve();
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({
      provider: 'codex',
      model: 'gpt-5.6-sol',
      effort: 'high',
    });
  });

  it('keeps the saved effort when only the model changes', async () => {
    const onCommit = vi.fn();
    const routing = { ...CLAUDE, effort: 'low' } as const;
    const { result } = renderHook(() => useRoutingDraft({ routing, onCommit }));

    await act(async () => {
      result.current.setModelId(chatModelId({ provider: 'anthropic', model: 'opus-5' }));
      await Promise.resolve();
    });

    expect(onCommit).toHaveBeenCalledWith({
      provider: 'anthropic',
      model: 'opus-5',
      effort: 'low',
    });
  });
});
