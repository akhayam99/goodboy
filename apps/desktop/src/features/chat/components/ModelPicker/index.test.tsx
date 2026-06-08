// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  const codexProps = {
    ...baseProps,
    providers: ['codex'] as ReadonlyArray<ProviderId>,
    models: [
      'gpt-5.5',
      'gpt-5.4',
      'gpt-5.2',
      'gpt-5.3-codex',
      'gpt-5.3-codex-spark',
      'gpt-5.4-mini',
    ],
    provider: 'codex' as ProviderId,
    model: 'gpt-5.5',
    connectedProviders: ['codex'] as ReadonlyArray<ProviderId>,
    defaultProvider: 'codex' as ProviderId,
    defaultModel: 'gpt-5.5',
  };

  it('maps the codex model id to its registry label in the trigger', () => {
    render(<ModelPicker {...codexProps} />);
    const trigger = screen.getByRole('button', { name: /codex/i });
    expect(trigger.textContent).toContain('GPT-5.5');
  });

  it('clusters codex versions into GPT-5 / Codex / Mini subfamily rows with effort', () => {
    render(<ModelPicker {...codexProps} />);
    fireEvent.click(screen.getByRole('button', { name: /codex/i }));
    const dialog = screen.getByRole('dialog', { name: /model picker/i });
    for (const label of ['GPT-5', 'Codex', 'Mini']) {
      expect(dialog.textContent).toContain(label);
    }
    expect(dialog.textContent).toContain('5.3 spark');
    expect(dialog.textContent).toContain('Minimal');
    expect(dialog.textContent).toContain('High');
  });
});
