// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MODEL_CATALOGS, PROVIDER_CAPABILITIES } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { tooltipTextOf } from '../../../__tests__/helpers/tooltip';
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
    expect(tooltipTextOf({ element: trigger })).toContain('Claude · Opus 5 · High · Brief');
  });

  it('still explains a disabled trigger when the caller gives no reason', () => {
    render(
      <RoutingPicker {...baseProps} disabled={true} verbosity="brief" onVerbosity={vi.fn()} />,
    );
    expect(tooltipTextOf({ element: screen.getByRole('button', { name: /routing/i }) })).toBe(
      'Claude · Opus 5 · High · Brief',
    );
  });

  it('prefers the caller reason over the summary on a disabled trigger', () => {
    render(<RoutingPicker {...baseProps} disabled={true} disabledTitle="the turn is running" />);
    expect(tooltipTextOf({ element: screen.getByRole('button', { name: /routing/i }) })).toBe(
      'the turn is running',
    );
  });

  it('offers the effort axis for Gemini because its cli refuses a model without one', () => {
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
    fireEvent.click(trigger);
    const effort = within(screen.getByRole('group', { name: 'Effort' }));
    expect(effort.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Low',
      'Medium',
      'High',
    ]);
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
    expect(screen.getByRole('button', { name: 'Sonnet' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: '4.6' }).getAttribute('aria-pressed')).toBe('true');
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
    fireEvent.click(screen.getByRole('button', { name: 'Opus' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));
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
    expect(screen.getByRole('button', { name: 'Sonnet' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: '4.6' }).getAttribute('aria-pressed')).toBe('true');
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
    const providerRow = screen.getByRole('button', { name: 'Cursor' }).closest('div');
    expect(providerRow?.querySelectorAll('svg')).toHaveLength(
      baseProps.connectedProviders.length + 1,
    );
  });

  it('reports the picked model and keeps the popover open', () => {
    const onModel = vi.fn();
    render(<RoutingPicker {...baseProps} onModel={onModel} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Sonnet' }));
    fireEvent.click(screen.getByRole('button', { name: '4.6' }));
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

  it('renders Cursor toggles once in a single Modes row', () => {
    render(
      <RoutingPicker
        {...baseProps}
        provider="cursor"
        model="composer-2.5-fast"
        effort={{ editable: true, value: 'medium', onChange: vi.fn() }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const modelOptions = screen.getByRole('region', { name: 'Model options' });
    const modes = within(modelOptions).getByRole('group', { name: 'Modes' });
    expect(within(modelOptions).getAllByText('Modes')).toHaveLength(1);
    expect(within(modelOptions).getAllByText('Fast')).toHaveLength(1);
    expect(within(modes).getByRole('button', { name: 'Fast' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(modes.className).toContain('justify-end');
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
    expect(screen.getByText('Effort adjusted from Low to High.')).toBeDefined();
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
    expect(high.getAttribute('title')).toBe(
      'High is unavailable for this model with the current toggles',
    );
    expect(
      within(screen.getByRole('group', { name: 'Effort' })).getAllByRole('button'),
    ).toHaveLength(5);
  });

  it('reshapes tuning labels for every provider that carries an effort axis', () => {
    const view = render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('group', { name: 'Effort' })).toBeDefined();

    view.unmount();
    const routerView = render(
      <RoutingPicker {...baseProps} provider="openrouter" model="gpt-5.4" />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('group', { name: 'Effort' })).toBeDefined();

    routerView.unmount();
    render(<RoutingPicker {...baseProps} provider="gemini" model="gemini-3.1-pro" />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(
      within(screen.getByRole('group', { name: 'Effort' }))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Low', 'High']);
  });

  it('omits variant and effort rows that Haiku does not have', () => {
    render(<RoutingPicker {...baseProps} model="haiku-4.5" />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const modelOptions = screen.getByRole('region', { name: 'Model options' });
    expect(within(modelOptions).queryByRole('group', { name: 'Effort' })).toBeNull();
    expect(within(modelOptions).queryByRole('group', { name: 'Variant' })).toBeNull();
  });

  it('omits the Variant row for Opus 5 while keeping its Effort row', () => {
    render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const modelOptions = screen.getByRole('region', { name: 'Model options' });
    expect(within(modelOptions).queryByRole('group', { name: 'Variant' })).toBeNull();
    expect(within(modelOptions).getByRole('group', { name: 'Effort' })).toBeDefined();
  });

  it('omits the version row for a model without a version axis', () => {
    render(<RoutingPicker {...baseProps} provider="cursor" model="auto" />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const modelOptions = screen.getByRole('region', { name: 'Model options' });
    expect(within(modelOptions).queryByRole('group', { name: 'Model Version' })).toBeNull();
  });

  it('shows a Max Mode advisory after failure and clears it after success', () => {
    cursorMaxModeAdvisory.mark({ accountId: 'unknown', model: 'sonnet-4.6' });
    render(
      <RoutingPicker
        {...baseProps}
        provider="cursor"
        model="claude-4.6-sonnet-medium"
        effort={{ editable: true, value: 'medium', onChange: vi.fn() }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('status', { name: 'Max Mode rejected' }).textContent).toBe(
      'Cursor rejected Max Mode for this model. Check that Max Mode is available on your account, then retry.',
    );

    act(() => {
      cursorMaxModeAdvisory.clear({ accountId: 'unknown', model: 'sonnet-4.6' });
    });

    expect(screen.queryByRole('status', { name: 'Max Mode rejected' })).toBeNull();
  });

  it('shows a static Max Mode requirement from the selected Cursor combination', () => {
    render(
      <RoutingPicker
        {...baseProps}
        provider="cursor"
        model="gpt-5.5-high"
        effort={{ editable: true, value: 'high', onChange: vi.fn() }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('status', { name: 'Max Mode' }).textContent).toBe(
      'Runs in Max Mode. Cursor bills Max Mode requests at a higher rate.',
    );
    expect(screen.queryByRole('status', { name: 'Max Mode rejected' })).toBeNull();
    expect(screen.getByRole('button', { name: 'GPT' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '5.5' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('renders authored model families and versions as separate chip levels', () => {
    render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const models = screen.getByRole('group', { name: 'Model' });
    expect(
      within(models)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Haiku', 'Sonnet', 'Opus', 'Fable']);
    fireEvent.click(within(models).getByRole('button', { name: 'Opus' }));
    expect(
      within(screen.getByRole('group', { name: 'Model Version' }))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['4.6', '4.7', '4.8', '5']);
  });

  it('selects an authored version without parsing the model id', () => {
    render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Opus' }));
    fireEvent.click(screen.getByRole('button', { name: '4.8' }));
    expect(screen.getByRole('button', { name: '4.8' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('renders multi-family catalogs without provider or family bands', () => {
    render(
      <RoutingPicker
        {...baseProps}
        provider="cursor"
        model="claude-opus-5-low"
        effort={{ editable: true, value: 'low', onChange: vi.fn() }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const models = screen.getByRole('group', { name: 'Model' });
    expect(within(models).queryByText('Claude')).toBeNull();
    expect(within(models).getByRole('button', { name: 'Opus' })).toBeDefined();
    expect(within(models).getByRole('button', { name: 'Auto' })).toBeDefined();
  });

  it('aligns every model axis to the end of its row', () => {
    render(<RoutingPicker {...baseProps} provider="codex" model="gpt-5.6-terra" />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const model = screen.getByRole('group', { name: 'Model' });
    const version = screen.getByRole('group', { name: 'Model Version' });
    const variant = screen.getByRole('button', { name: 'Terra' }).parentElement;
    const effort = screen.getByRole('group', { name: 'Effort' });
    expect(
      [model, version, variant, effort].every((group) => group?.className.includes('justify-end')),
    ).toBe(true);
    expect(
      [model, version, variant, effort].every((group) =>
        group?.parentElement?.className.includes('justify-end'),
      ),
    ).toBe(true);
  });

  it('offers verbosity only when the caller wires it', () => {
    const view = render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('dialog').textContent).not.toContain('Replies');
    view.rerender(<RoutingPicker {...baseProps} verbosity="brief" onVerbosity={vi.fn()} />);
    expect(screen.getByRole('dialog').textContent).toContain('Replies');
  });

  it('offers only connected providers', () => {
    render(<RoutingPicker {...baseProps} connectedProviders={['anthropic']} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('button', { name: 'Claude' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Codex' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cursor' })).toBeNull();
  });

  it('links the connected provider row to the in-app Providers surface', () => {
    render(<RoutingPicker {...baseProps} connectedProviders={['anthropic']} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const addProvider = screen.getByRole('button', { name: 'Add provider' });
    const onOpenProviderStudio = vi.fn();
    window.addEventListener('goodboy:open-provider-studio', onOpenProviderStudio);
    fireEvent.click(addProvider);
    window.removeEventListener('goodboy:open-provider-studio', onOpenProviderStudio);
    expect(onOpenProviderStudio).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'routing' })).toBeNull();
  });

  it('keeps a disconnected selection visible and marked', () => {
    render(
      <RoutingPicker
        {...baseProps}
        connectedProviders={['anthropic']}
        provider="codex"
        model="gpt-5.6"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(tooltipTextOf({ element: screen.getByRole('button', { name: 'Codex' }) })).toBe(
      'Codex is not connected',
    );
    expect(screen.getByText('Codex is not connected')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Cursor' })).toBeNull();
  });

  it('links the empty provider state to the providers studio', () => {
    const events: CustomEvent[] = [];
    const onOpenProviderStudio = (event: Event) => {
      if (event instanceof CustomEvent) {
        events.push(event);
      }
    };
    window.addEventListener('goodboy:open-provider-studio', onOpenProviderStudio);
    render(<RoutingPicker {...baseProps} connectedProviders={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByText('No providers connected')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open providers' }));
    expect(events).toHaveLength(1);
    window.removeEventListener('goodboy:open-provider-studio', onOpenProviderStudio);
  });

  it('focuses the selected model chip when the popover opens', () => {
    render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('button', { name: 'Opus' })).toBe(document.activeElement);
  });

  it('portals the popup and keeps inside pointer events open', () => {
    render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    const dialog = screen.getByRole('dialog');
    const portal = dialog.closest('[data-dropdown-portal]');
    expect(portal?.parentElement).toBe(document.body);
    expect(dialog.className).toContain('fixed');
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Opus' }));
    expect(screen.getByRole('dialog')).toBe(dialog);
  });

  it('mounts the popup inside the open dialog containing its trigger', () => {
    render(
      <dialog open aria-label="diff viewer">
        <RoutingPicker {...baseProps} />
      </dialog>,
    );
    const hostDialog = screen.getByRole('dialog', { name: 'diff viewer' });
    fireEvent.click(within(hostDialog).getByRole('button', { name: /routing/i }));

    const pickerDialog = screen.getByRole('dialog', { name: 'routing' });
    expect(hostDialog.contains(pickerDialog)).toBe(true);
    expect(pickerDialog.closest('[data-dropdown-portal]')?.parentElement).toBe(hostDialog);
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
    const providerRow = providerButton.closest('div');
    expect(providerRow?.className).toContain('gap-1.5');
    expect(providerRow?.className).toContain('[&>*]:flex-1');
    expect(providerButton.className).toContain('min-w-0');
  });
});
