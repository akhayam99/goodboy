// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import { RoutingPicker } from './index';

const baseProps = {
  providers: ['anthropic', 'codex'] as ReadonlyArray<ProviderId>,
  provider: 'anthropic' as ProviderId,
  model: 'claude-opus-5',
  effort: 'high' as const,
  disabled: false,
  ariaLabel: 'routing',
  onProvider: vi.fn(),
  onModel: vi.fn(),
  onEffort: vi.fn(),
};

afterEach(cleanup);

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
    expect(trigger.textContent).toContain('recommended');
  });

  it('reports the picked model and closes the popover', () => {
    const onModel = vi.fn();
    render(<RoutingPicker {...baseProps} onModel={onModel} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    fireEvent.click(screen.getByTitle('claude-sonnet-4-6'));
    expect(onModel).toHaveBeenCalledWith('claude-sonnet-4-6');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers verbosity only when the caller wires it', () => {
    const view = render(<RoutingPicker {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByRole('dialog').textContent).not.toContain('Replies');
    view.rerender(<RoutingPicker {...baseProps} verbosity="brief" onVerbosity={vi.fn()} />);
    expect(screen.getByRole('dialog').textContent).toContain('Replies');
  });

  it('marks unconnected providers as a connect affordance', () => {
    render(<RoutingPicker {...baseProps} connectedProviders={['anthropic']} />);
    fireEvent.click(screen.getByRole('button', { name: /routing/i }));
    expect(screen.getByTitle('not connected, click to connect').textContent).toContain('Codex');
  });
});
