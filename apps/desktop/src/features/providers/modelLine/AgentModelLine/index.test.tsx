// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { modelLineOf } from '../modelLineOf';
import { AgentModelLine } from './index';

afterEach(cleanup);

describe('AgentModelLine', () => {
  it('shows the provider mark, the display name and the effort, muted', () => {
    const { container } = render(
      <AgentModelLine
        line={modelLineOf({ provider: 'anthropic', model: 'sonnet-5.5', effort: 'high' })}
      />,
    );

    const line = container.querySelector('[data-model-line]');
    expect(line?.textContent).toBe('Sonnet 5.5 High');
    expect(line?.querySelector('svg')).not.toBeNull();
    expect(screen.queryByText('sonnet-5.5')).toBeNull();
  });

  it('renders nothing when no model is known', () => {
    const { container } = render(
      <AgentModelLine line={modelLineOf({ provider: null, model: null, effort: null })} />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('names an id the catalog lacks by its words and keeps the raw id for the tooltip only', async () => {
    const { container } = render(
      <AgentModelLine
        line={modelLineOf({ provider: 'anthropic', model: 'ledger-core-1', effort: 'high' })}
      />,
    );

    const line = container.querySelector('[data-model-line]');
    if (line === null) {
      throw new Error('no model line');
    }
    expect(line.textContent).toBe('Ledger Core 1');
    expect(container.textContent).not.toContain('ledger-core-1');

    fireEvent.mouseEnter(line);

    expect((await screen.findByRole('tooltip', undefined, { timeout: 2_000 })).textContent).toBe(
      'ledger-core-1',
    );
  });
});
