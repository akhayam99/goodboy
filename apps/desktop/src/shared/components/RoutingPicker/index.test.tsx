// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../features/chat/utils/chat-constants';
import { RoutingPicker } from './index';

const baseProps = {
  connectedProviders: ['anthropic', 'cursor', 'codex', 'gemini'] as ReadonlyArray<ProviderId>,
  provider: 'anthropic' as ProviderId,
  model: 'claude-opus-5',
  effort: 'high' as const,
  disabled: false,
  ariaLabel: 'routing',
  onProvider: vi.fn(),
  onModel: vi.fn(),
  onEffort: vi.fn(),
};
const providers = Object.keys(PROVIDER_CAPABILITIES).filter(
  (id): id is ProviderId => id in PROVIDER_CAPABILITIES,
);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RoutingPicker', () => {
  it('reads provider, model and effort in the closed trigger', () => {
    render(<RoutingPicker {...baseProps} />);
    const trigger = screen.getByRole('button', { name: /routing/i });
    expect(trigger.textContent).toContain('Claude');
    expect(trigger.textContent).toContain('Opus 5');
    expect(trigger.textContent).toContain('High');
  });

  it('drops the effort segment and explains why for a model without thinking levels', () => {
    render(<RoutingPicker {...baseProps} model="claude-haiku-4-5" ariaLabel="routing" />);
    const trigger = screen.getByRole('button', { name: 'routing' });
    expect(trigger.textContent).toContain('Haiku 4.5');
    expect(trigger.textContent).not.toContain('High');
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog').textContent).toContain('no thinking levels');
  });

  it('resolves the recommended state to a concrete model', () => {
    render(<RoutingPicker {...baseProps} model="" recommendedModel="claude-sonnet-4-6" />);
    const trigger = screen.getByRole('button', { name: /routing/i });
    expect(trigger.textContent).toContain('Sonnet 4.6');
    expect(trigger.textContent).not.toContain('recommended');
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog').textContent).toContain('auto');
    expect(screen.getByRole('dialog').textContent).not.toContain('recommended');
  });

  it('reports the picked model and keeps the popover open', () => {
    const onModel = vi.fn();
    render(<RoutingPicker {...baseProps} onModel={onModel} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    fireEvent.click(screen.getByTitle(/^claude-sonnet-4-6 \(/));
    expect(onModel).toHaveBeenCalledWith('claude-sonnet-4-6');
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('reports the picked provider and keeps the popover open', () => {
    const onProvider = vi.fn();
    render(<RoutingPicker {...baseProps} onProvider={onProvider} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));
    expect(onProvider).toHaveBeenCalledWith('cursor');
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('reports the picked effort and keeps the popover open', () => {
    const onEffort = vi.fn();
    render(<RoutingPicker {...baseProps} onEffort={onEffort} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Medium' }));
    expect(onEffort).toHaveBeenCalledWith('medium');
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('bounds only the model list as the scroll region', () => {
    render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const dialog = screen.getByRole('dialog');
    const viewports = dialog.querySelectorAll('[class*="overflow-y-auto"]');
    const viewport = viewports.item(0);
    expect(viewports).toHaveLength(1);
    expect(viewport?.parentElement?.className).toContain('max-h-[15rem]');
    expect(viewport?.className).toContain('max-h-[inherit]');
    expect(dialog.className).not.toMatch(/max-h-/);
    const modelIds = PROVIDER_CAPABILITIES.anthropic.models.map((entry) => entry.id);
    expect(modelIds.length).toBeGreaterThan(3);
    for (const id of modelIds) {
      const chips = Array.from(viewport?.querySelectorAll('[title]') ?? []);
      expect(chips.some((chip) => chip.getAttribute('title')?.startsWith(`${id} (`))).toBe(true);
    }
  });

  it('offers verbosity only when the caller wires it', () => {
    const view = render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('dialog').textContent).not.toContain('Replies');
    view.rerender(<RoutingPicker {...baseProps} verbosity="brief" onVerbosity={vi.fn()} />);
    expect(screen.getByRole('dialog').textContent).toContain('Replies');
  });

  it('shows every registry provider when only one is connected', () => {
    render(<RoutingPicker {...baseProps} connectedProviders={['anthropic']} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    for (const id of providers) {
      expect(screen.getByRole('button', { name: PROVIDER_LABEL[id] })).toBeDefined();
    }
  });

  it('offers to connect an unconnected provider without selecting it', () => {
    const onProvider = vi.fn();
    const events: CustomEvent[] = [];
    const onOpenProviderStudio = (event: Event) => {
      if (event instanceof CustomEvent) {
        events.push(event);
      }
    };
    window.addEventListener('goodboy:open-provider-studio', onOpenProviderStudio);
    render(
      <RoutingPicker {...baseProps} connectedProviders={['anthropic']} onProvider={onProvider} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Codex' }));
    expect(onProvider).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Connect Codex' }));
    expect(events).toHaveLength(1);
    expect(events[0]?.detail.providerId).toBe('codex');
    expect(screen.queryByRole('dialog')).toBeNull();
    window.removeEventListener('goodboy:open-provider-studio', onOpenProviderStudio);
  });

  it('filters cursor models and omits the filter for anthropic', () => {
    const cursorModel = PROVIDER_CAPABILITIES.cursor.models.at(-1);
    if (cursorModel == null) {
      throw new Error('cursor model registry is empty');
    }
    const view = render(
      <RoutingPicker
        {...baseProps}
        provider="cursor"
        model={PROVIDER_CAPABILITIES.cursor.models[0]?.id ?? ''}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const filter = screen.getByPlaceholderText('Filter models');
    fireEvent.change(filter, { target: { value: cursorModel.label } });
    const modelChips = screen
      .getAllByRole('button')
      .filter((button) => button.title.includes(' ('));
    expect(modelChips).toHaveLength(1);
    expect(modelChips[0]?.title).toContain(cursorModel.id);
    view.unmount();

    render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.queryByPlaceholderText('Filter models')).toBeNull();
  });
});
