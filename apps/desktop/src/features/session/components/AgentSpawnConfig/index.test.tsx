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
  it('keeps defaults compact and updates provider, model, effort, and hint', () => {
    const onChange = vi.fn<(value: AgentSpawnConfigValue) => void>();
    const view = render(
      <AgentSpawnConfig value={DEFAULT_AGENT_SPAWN_CONFIG} onChange={onChange} disabled={false} />,
    );

    expect(screen.queryByRole('textbox', { name: 'Agent hint' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Agent settings/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Default$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Codex$/i }));
    const providerValue = onChange.mock.calls[0]![0];
    expect(providerValue).toEqual({
      provider: 'codex',
      model: 'gpt-5.6',
      effort: 'low',
      hint: '',
    });

    view.rerender(<AgentSpawnConfig value={providerValue} onChange={onChange} disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: /^GPT-5\.6$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^GPT-5\.4 Mini$/i }));
    const modelValue = onChange.mock.calls[1]![0];
    expect(modelValue.model).toBe('gpt-5.4-mini');

    view.rerender(<AgentSpawnConfig value={modelValue} onChange={onChange} disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: /^Low$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Medium$/i }));
    const effortValue = onChange.mock.calls[2]![0];
    expect(effortValue.effort).toBe('medium');

    view.rerender(<AgentSpawnConfig value={effortValue} onChange={onChange} disabled={false} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Agent hint' }), {
      target: { value: 'Emphasize the migration path.' },
    });
    expect(onChange.mock.calls[3]![0].hint).toBe('Emphasize the migration path.');
  });
});
