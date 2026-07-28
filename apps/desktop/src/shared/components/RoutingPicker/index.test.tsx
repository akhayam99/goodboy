// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../features/chat/utils/chat-constants';
import { cursorMaxModeAdvisory } from '../../lib/cursorMaxModeAdvisory';
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
  localStorage.clear();
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

  it('shows the muted no-tuning line for Gemini', () => {
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
    expect(screen.getByRole('region', { name: 'Tuning' }).textContent).toContain(
      'No tuning options for this provider',
    );
  });

  it('keeps provider tuning visible but disabled when the caller cannot edit effort', () => {
    render(<RoutingPicker {...baseProps} effort={{ editable: false }} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const effort = screen.getByRole('group', { name: 'Effort' });
    expect(
      within(effort)
        .getAllByRole('button')
        .every((button) => button.hasAttribute('disabled')),
    ).toBe(true);
  });

  it('resolves a model recommendation to a concrete model without saying auto', () => {
    render(
      <RoutingPicker {...baseProps} model="" recommendation={{ model: 'claude-sonnet-4-6' }} />,
    );
    const trigger = screen.getByRole('button', { name: /routing/i });
    expect(trigger.textContent).toContain('Sonnet 4.6');
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Sonnet 4.6, Recommended' })).toBeDefined();
    expect(screen.getByRole('dialog').textContent).not.toContain('auto');
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
    fireEvent.click(screen.getByRole('button', { name: 'Opus 5' }));
    expect(row.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Claude' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('marks the recommended catalog row when the recommendation names no provider', () => {
    render(
      <RoutingPicker {...baseProps} model="" recommendation={{ model: 'claude-sonnet-4-6' }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('button', { name: 'Sonnet 4.6, Recommended' })).toBeDefined();
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
    expect(screen.queryByRole('button', { name: 'Sonnet 4.6, Recommended' })).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: 'Sonnet 4.6' }));
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

  it('shows Codex checkpoints in a variant row above effort', () => {
    const onModel = vi.fn();
    render(
      <RoutingPicker {...baseProps} provider="codex" model="gpt-5.6-terra" onModel={onModel} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('button', { name: 'Terra' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Luna' }));
    expect(onModel).toHaveBeenCalledWith('gpt-5.6-luna');
  });

  it('shows the Codex variant row only for a family with sibling checkpoints', () => {
    const view = render(<RoutingPicker {...baseProps} provider="codex" model="gpt-5.6-sol" />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('button', { name: 'Sol' })).toBeDefined();

    view.unmount();
    render(<RoutingPicker {...baseProps} provider="codex" model="gpt-5.5" />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.queryByRole('button', { name: 'Sol' })).toBeNull();
  });

  it('selects the matching Codex checkpoint when search finds a variant', () => {
    const onModel = vi.fn();
    render(<RoutingPicker {...baseProps} provider="codex" model="gpt-5.5" onModel={onModel} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search models' }), {
      target: { value: 'terra' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'GPT-5.6, Terra' }));
    expect(onModel).toHaveBeenCalledWith('gpt-5.6-terra');
    expect(screen.getByRole('button', { name: 'Terra' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('clamps Cursor effort after a toggle invalidates it and announces the adjustment', () => {
    const onModel = vi.fn();
    const onChange = vi.fn();
    render(
      <RoutingPicker
        {...baseProps}
        provider="cursor"
        model="claude-opus-5-low"
        onModel={onModel}
        effort={{ editable: true, value: 'low', onChange }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Thinking' }));
    expect(onModel).toHaveBeenCalledWith('claude-opus-5-thinking-high');
    expect(onChange).toHaveBeenCalledWith('high');
    expect(screen.getByRole('status').textContent).toContain('adjusted from Low to High');
  });

  it('keeps unavailable Cursor effort cells disabled with an explanation', () => {
    render(
      <RoutingPicker
        {...baseProps}
        provider="cursor"
        model="claude-4.6-sonnet-medium"
        effort={{ editable: true, value: 'medium', onChange: vi.fn() }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const high = screen.getByRole('button', { name: 'High' });
    expect(high.hasAttribute('disabled')).toBe(true);
    expect(high.getAttribute('title')).toContain('unavailable for Sonnet 4.6');
    expect(
      within(screen.getByRole('group', { name: 'Effort' })).getAllByRole('button'),
    ).toHaveLength(5);
  });

  it('reshapes tuning labels for effort, variant, and no-option providers', () => {
    const view = render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('group', { name: 'Effort' })).toBeDefined();

    view.unmount();
    const routerView = render(
      <RoutingPicker {...baseProps} provider="openrouter" model="gpt-5.4" />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('group', { name: 'Variant' })).toBeDefined();

    routerView.unmount();
    render(<RoutingPicker {...baseProps} provider="gemini" model="gemini-3.1-pro" />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('region', { name: 'Tuning' }).textContent).toContain(
      'No tuning options for this provider',
    );
  });

  it('shows a Max Mode advisory after failure and clears it after success', () => {
    cursorMaxModeAdvisory.mark({ accountId: 'unknown', model: 'gpt-5.5' });
    render(
      <RoutingPicker
        {...baseProps}
        provider="cursor"
        model="gpt-5.5-high"
        effort={{ editable: true, value: 'high', onChange: vi.fn() }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('status', { name: 'Max Mode required previously' })).toBeDefined();

    act(() => {
      cursorMaxModeAdvisory.clear({ accountId: 'unknown', model: 'gpt-5.5' });
    });

    expect(screen.queryByRole('status', { name: 'Max Mode required previously' })).toBeNull();
    expect(screen.getByRole('button', { name: 'GPT-5.5' })).toBeDefined();
  });

  it('renders every catalog model as one canonical row', () => {
    render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const models = screen.getByRole('region', { name: 'Models' });
    for (const entry of PROVIDER_CAPABILITIES.anthropic.models) {
      expect(within(models).getByRole('button', { name: entry.label })).toBeDefined();
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

  it('always focuses the searchable model list when the popover opens', () => {
    const view = render(
      <RoutingPicker
        {...baseProps}
        provider="cursor"
        model={PROVIDER_CAPABILITIES.cursor.models[0]?.id ?? ''}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('textbox', { name: 'Search models' })).toBe(document.activeElement);
    view.unmount();

    render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('textbox', { name: 'Search models' })).toBe(document.activeElement);
  });

  it('shows the exact resolved model arguments in the footer', () => {
    render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('contentinfo').textContent).toBe('--model claude-opus-5 --effort high');
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
