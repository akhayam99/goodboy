import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import type { AgentSpawnConfigValue } from './AgentSpawnConfigValue';
import { DEFAULT_AGENT_SPAWN_CONFIG } from './defaultAgentSpawnConfig';

type Store = {
  readonly providers: ReadonlyArray<{
    readonly id: ProviderId;
    readonly connection: string;
  }>;
};

const h = vi.hoisted(() => ({
  providers: [
    { id: 'anthropic', connection: 'connected' },
    { id: 'codex', connection: 'connected' },
  ] satisfies Store['providers'],
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) => selector({ providers: h.providers }),
}));

import { AgentSpawnConfig } from './index';

afterEach(cleanup);

describe('AgentSpawnConfig', () => {
  it('routes provider, model, effort and hint through one picker', () => {
    const onChange = vi.fn<(value: AgentSpawnConfigValue) => void>();
    const view = render(
      <AgentSpawnConfig value={DEFAULT_AGENT_SPAWN_CONFIG} onChange={onChange} disabled={false} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Agent settings:/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Codex/ }));
    const providerValue = onChange.mock.calls[0]![0];
    expect(providerValue.provider).toBe('codex');

    view.rerender(<AgentSpawnConfig value={providerValue} onChange={onChange} disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'GPT-5.4 Mini' }));
    expect(onChange.mock.calls[1]![0].model).toBe('gpt-5.4-mini');

    fireEvent.change(screen.getByRole('textbox', { name: 'Agent hint' }), {
      target: { value: 'Emphasize the migration path.' },
    });
    expect(onChange.mock.calls.at(-1)?.[0].hint).toBe('Emphasize the migration path.');
  });

  it('shows the effort of the selected model in the trigger', () => {
    render(
      <AgentSpawnConfig
        value={{ provider: 'anthropic', model: 'claude-sonnet-4-6', effort: 'high', hint: '' }}
        onChange={vi.fn()}
        disabled={false}
      />,
    );
    expect(screen.getByRole('button', { name: /^Agent settings:/ }).textContent).toContain('High');
  });
});
