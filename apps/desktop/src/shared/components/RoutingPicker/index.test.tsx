// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../features/chat/utils/chat-constants';
import { RoutingPicker } from './index';

const baseProps = {
  connectedProviders: [
    'anthropic',
    'cursor',
    'codex',
    'gemini',
    'opencode',
    'openrouter',
  ] as ReadonlyArray<ProviderId>,
  provider: 'anthropic' as ProviderId,
  model: 'claude-opus-5',
  effort: { editable: true, value: 'high', onChange: vi.fn() } as const,
  disabled: false,
  ariaLabel: 'routing',
  onProvider: vi.fn(),
  onModel: vi.fn(),
};
const providers = Object.keys(PROVIDER_CAPABILITIES).filter(
  (id): id is ProviderId => id in PROVIDER_CAPABILITIES,
);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RoutingPicker', () => {
  it('reads model and effort in the closed trigger, never the provider name', () => {
    render(<RoutingPicker {...baseProps} />);
    const trigger = screen.getByRole('button', { name: /routing/i });
    expect(trigger.textContent).toContain('Opus 5');
    expect(trigger.textContent).toContain('High');
    expect(trigger.textContent).not.toContain('Claude');
  });

  it('keeps the full routing in the accessible name and the tooltip', () => {
    render(<RoutingPicker {...baseProps} verbosity="brief" onVerbosity={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /routing/i });
    expect(trigger.getAttribute('aria-label')).toBe('routing: Claude · Opus 5 · High · Brief');
    expect(trigger.getAttribute('title')).toContain('Claude · Opus 5 · High · Brief');
  });

  it('still explains a disabled trigger when the caller gives no reason', () => {
    render(
      <RoutingPicker {...baseProps} disabled={true} verbosity="brief" onVerbosity={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /routing/i }).getAttribute('title')).toBe(
      'Claude · Opus 5 · High · Brief',
    );
  });

  it('prefers the caller reason over the summary on a disabled trigger', () => {
    render(<RoutingPicker {...baseProps} disabled={true} disabledTitle="the turn is running" />);
    expect(screen.getByRole('button', { name: /routing/i }).getAttribute('title')).toBe(
      'the turn is running',
    );
  });

  it('keeps a disabled default effort control for a model without an effort axis', () => {
    render(
      <RoutingPicker
        {...baseProps}
        provider="gemini"
        model="gemini-3.5-flash"
        ariaLabel="routing"
      />,
    );
    const trigger = screen.getByRole('button', { name: /^routing:/ });
    expect(trigger.textContent).toContain('3.5 Flash');
    expect(trigger.textContent).not.toContain('High');
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Default' }).hasAttribute('disabled')).toBe(true);
  });

  it('drops the whole effort section when the caller cannot edit effort', () => {
    render(<RoutingPicker {...baseProps} effort={{ editable: false }} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).not.toContain('Effort');
    expect(dialog.textContent).not.toContain('fixed effort');
  });

  it('resolves a model recommendation to a concrete model without saying auto', () => {
    render(
      <RoutingPicker {...baseProps} model="" recommendation={{ model: 'claude-sonnet-4-6' }} />,
    );
    const trigger = screen.getByRole('button', { name: /routing/i });
    expect(trigger.textContent).toContain('Sonnet 4.6');
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Recommended');
    expect(dialog.textContent).not.toContain('auto');
  });

  it('offers no recommendation chip when the caller passes no recommendation', () => {
    render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.queryByRole('button', { name: /^Recommended/ })).toBeNull();
  });

  it('puts a provider recommendation in its own row above the provider tabs', () => {
    const onProvider = vi.fn();
    render(
      <RoutingPicker
        {...baseProps}
        provider=""
        model=""
        onProvider={onProvider}
        recommendation={{ provider: 'anthropic', model: 'claude-sonnet-4-6' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const row = screen.getByRole('button', { name: 'Recommended Claude · Sonnet 4.6' });
    expect(row.querySelector('svg')).toBeNull();
    fireEvent.click(row);
    expect(onProvider).toHaveBeenCalledWith('');
  });

  it('marks the recommended provider tab as secondary, never as selected', () => {
    render(
      <RoutingPicker
        {...baseProps}
        provider=""
        model=""
        recommendation={{ provider: 'anthropic', model: 'claude-sonnet-4-6' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const tab = screen.getByRole('button', { name: 'Claude' });
    expect(tab.getAttribute('aria-pressed')).toBe('false');
    expect(tab.className).toContain('ring-border-soft');
    expect(tab.className).not.toContain('shadow-sm');
  });

  it('marks the recommendation row active while a concrete provider still inherits the default', () => {
    render(
      <RoutingPicker
        {...baseProps}
        provider="anthropic"
        model=""
        overridden={false}
        recommendation={{ provider: 'anthropic', model: 'claude-sonnet-4-6' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(
      screen
        .getByRole('button', { name: 'Recommended Claude · Sonnet 4.6' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    const tab = screen.getByRole('button', { name: 'Claude' });
    expect(tab.getAttribute('aria-pressed')).toBe('false');
    expect(tab.className).toContain('ring-border-soft');
  });

  it('drops the recommendation row highlight as soon as a concrete model is picked', () => {
    render(
      <RoutingPicker
        {...baseProps}
        provider="anthropic"
        model=""
        overridden={false}
        recommendation={{ provider: 'anthropic', model: 'claude-sonnet-4-6' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const row = screen.getByRole('button', { name: 'Recommended Claude · Sonnet 4.6' });
    fireEvent.click(screen.getByTitle(/^opus-5 \(/));
    expect(row.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Claude' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('keeps the model grid recommendation chip when the recommendation names no provider', () => {
    render(
      <RoutingPicker {...baseProps} model="" recommendation={{ model: 'claude-sonnet-4-6' }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByTitle('Recommended (Sonnet 4.6)')).toBeDefined();
  });

  it('suppresses the model grid recommendation chip when the recommendation names a provider', () => {
    render(
      <RoutingPicker
        {...baseProps}
        model=""
        recommendation={{ provider: 'anthropic', model: 'claude-sonnet-4-6' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.queryByTitle('Recommended (Sonnet 4.6)')).toBeNull();
    expect(screen.getByRole('button', { name: 'Recommended Claude · Sonnet 4.6' })).toBeDefined();
  });

  it('renders each provider mark once in the provider row', () => {
    render(
      <RoutingPicker
        {...baseProps}
        provider=""
        recommendation={{ provider: 'anthropic', model: 'claude-sonnet-4-6' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const providerRow = screen.getByRole('button', { name: 'Cursor' }).parentElement;
    expect(providerRow?.querySelectorAll('svg')).toHaveLength(providers.length);
  });

  it('reports the picked model and keeps the popover open', () => {
    const onModel = vi.fn();
    render(<RoutingPicker {...baseProps} onModel={onModel} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    fireEvent.click(screen.getByTitle(/^sonnet-4.6 \(/));
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

  it('hides the recommendation chip when it does not apply to the viewed provider', () => {
    render(
      <RoutingPicker {...baseProps} model="" recommendation={{ model: 'claude-sonnet-4-6' }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Codex' }));
    expect(screen.queryByRole('button', { name: /^Recommended/ })).toBeNull();
  });

  it('offers Cursor literal auto as a plain model chip', () => {
    const onModel = vi.fn();
    render(
      <RoutingPicker
        {...baseProps}
        model=""
        recommendation={{ model: 'claude-sonnet-4-6' }}
        onModel={onModel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
    expect(onModel).toHaveBeenCalledWith('auto');
  });

  it('reports the picked effort and keeps the popover open', () => {
    const onChange = vi.fn();
    render(<RoutingPicker {...baseProps} effort={{ editable: true, value: 'high', onChange }} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Medium' }));
    expect(onChange).toHaveBeenCalledWith('medium');
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('keeps Codex checkpoints in a secondary variant select', () => {
    const onModel = vi.fn();
    render(
      <RoutingPicker {...baseProps} provider="codex" model="gpt-5.6-terra" onModel={onModel} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const select = screen.getByRole('combobox', { name: 'GPT-5.6 variant' });
    expect((select as HTMLSelectElement).value).toBe('terra');
    fireEvent.change(select, { target: { value: 'luna' } });
    expect(onModel).toHaveBeenCalledWith('gpt-5.6-luna');
  });

  it('re-filters Cursor effort when thinking changes and reports the clamp', () => {
    const onModel = vi.fn();
    const onChange = vi.fn();
    render(
      <RoutingPicker
        {...baseProps}
        provider="cursor"
        model="claude-4.6-sonnet-high"
        onModel={onModel}
        effort={{ editable: true, value: 'high', onChange }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Thinking' }));
    expect(onModel).toHaveBeenCalledWith('claude-4.6-sonnet-medium-thinking');
    expect(onChange).toHaveBeenCalledWith('medium');
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

  it('does not show a model filter for providers with large or small model registries', () => {
    const view = render(
      <RoutingPicker
        {...baseProps}
        provider="cursor"
        model={PROVIDER_CAPABILITIES.cursor.models[0]?.id ?? ''}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.queryByPlaceholderText('Filter models')).toBeNull();
    view.unmount();

    render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.queryByPlaceholderText('Filter models')).toBeNull();
  });

  it('tints model variants by cost tier and intensifies the active chip', () => {
    render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const expensiveChip = screen.getByTitle(/^opus-5 \(/);
    const cheapChip = screen.getByTitle(/^haiku-4.5 \(/);
    expect(expensiveChip.textContent).not.toContain('$$');
    expect(expensiveChip.className).toContain('bg-danger/20');
    expect(expensiveChip.className).toContain('text-danger');
    expect(expensiveChip.className).toContain('ring-danger/40');
    expect(cheapChip.className).toContain('bg-success/10');
    expect(cheapChip.className).toContain('text-success/70');
    expect(cheapChip.className).not.toContain('ring-success/40');
  });

  it('distributes provider tabs evenly across the row', () => {
    render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const providerButton = screen.getByRole('button', { name: 'Cursor' });
    const providerRow = providerButton.parentElement;
    expect(providerRow?.className).toContain('gap-1.5');
    expect(providerRow?.className).toContain('[&>button]:flex-1');
    expect(providerButton.className).toContain('min-w-0');
  });
});
