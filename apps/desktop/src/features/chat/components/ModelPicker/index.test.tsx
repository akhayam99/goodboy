// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';

import { ModelPicker } from './index';

const baseProps = {
  providers: ['anthropic'] as ReadonlyArray<ProviderId>,
  models: ['claude-opus-4-7'],
  provider: 'anthropic' as ProviderId,
  model: 'claude-opus-4-7',
  effort: 'medium' as const,
  verbosity: 'normal' as const,
  connectedProviders: ['anthropic'] as ReadonlyArray<ProviderId>,
  disabled: false,
  defaultProvider: 'anthropic' as ProviderId,
  defaultModel: 'claude-opus-4-7',
  onSelectProvider: vi.fn(),
  onSelectModel: vi.fn(),
  onSelectEffort: vi.fn(),
  onSelectVerbosity: vi.fn(),
  onResetToDefault: vi.fn(),
};

afterEach(cleanup);

describe('ModelPicker', () => {
  it('renders a trigger button with aria-haspopup dialog', () => {
    render(<ModelPicker {...baseProps} />);
    const btn = screen.getByRole('button', { name: /claude/i });
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('disables the trigger when the disabled prop is true', () => {
    render(<ModelPicker {...baseProps} disabled disabledTitle="locked" />);
    const btns = screen.getAllByRole('button');
    const trigger = btns.find((b) => (b as HTMLButtonElement).disabled);
    expect(trigger).toBeDefined();
  });
});
