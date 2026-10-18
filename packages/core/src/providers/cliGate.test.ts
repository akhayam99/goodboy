import { describe, expect, it } from 'vitest';
import { cliGate, cliSupportedSibling, outdatedCliModels } from './cliGate';

describe('cliGate', () => {
  it('gates a model whose catalog minimum is above the installed CLI', () => {
    const gate = cliGate({
      provider: 'anthropic',
      modelKey: 'opus-5.5',
      installedVersion: '2.1.259 (Claude Code)',
      learned: [],
    });
    expect(gate?.model.label).toBe('Opus 5.5');
    expect(gate?.requiredVersion).toBe('2.1.280');
    expect(gate?.installedVersion).toBe('2.1.259');
  });

  it('lets the model through once the CLI is new enough', () => {
    expect(
      cliGate({
        provider: 'anthropic',
        modelKey: 'opus-5.5',
        installedVersion: '2.1.281',
        learned: [],
      }),
    ).toBeNull();
  });

  it('never gates when the installed version is unknown', () => {
    expect(
      cliGate({ provider: 'anthropic', modelKey: 'opus-5.5', installedVersion: null, learned: [] }),
    ).toBeNull();
  });

  it('uses a requirement learned from a refusal when the catalog has none', () => {
    const gate = cliGate({
      provider: 'anthropic',
      modelKey: 'opus-5',
      installedVersion: '2.1.200',
      learned: [{ providerId: 'anthropic', modelKey: 'opus-5', requiredVersion: '2.1.230' }],
    });
    expect(gate?.requiredVersion).toBe('2.1.230');
  });

  it('keeps the higher of the catalog and the learned requirement', () => {
    const gate = cliGate({
      provider: 'anthropic',
      modelKey: 'opus-5.5',
      installedVersion: '2.1.285',
      learned: [{ providerId: 'anthropic', modelKey: 'opus-5.5', requiredVersion: '2.1.290' }],
    });
    expect(gate?.requiredVersion).toBe('2.1.290');
  });
});

describe('cliSupportedSibling', () => {
  it('stays on the same line, so an old Codex CLI is offered the older Sol, never Astra', () => {
    expect(
      cliSupportedSibling({
        provider: 'codex',
        modelKey: 'gpt-6.1-sol',
        installedVersion: '0.155.0',
        learned: [],
      })?.key,
    ).toBe('gpt-5.6-sol');
    expect(
      cliSupportedSibling({
        provider: 'codex',
        modelKey: 'gpt-6-luna',
        installedVersion: '0.161.0',
        learned: [],
      })?.key,
    ).toBe('gpt-5.6-luna');
  });

  it('offers the newest model of the same group the installed CLI runs', () => {
    expect(
      cliSupportedSibling({
        provider: 'anthropic',
        modelKey: 'opus-5.5',
        installedVersion: '2.1.259',
        learned: [],
      })?.key,
    ).toBe('opus-5');
    expect(
      cliSupportedSibling({
        provider: 'anthropic',
        modelKey: 'fable-5.1',
        installedVersion: '2.1.240',
        learned: [],
      })?.key,
    ).toBe('fable-5');
  });
});

describe('outdatedCliModels', () => {
  it('lists every gated model, newest first', () => {
    const gates = outdatedCliModels({
      provider: 'anthropic',
      installedVersion: '2.1.240',
      learned: [],
    });
    expect(gates.map((gate) => gate.model.key)).toEqual([
      'fable-5.1',
      'opus-5.5',
      'sonnet-5.5',
      'haiku-5.5',
    ]);
  });

  it('is empty on a current CLI', () => {
    expect(
      outdatedCliModels({ provider: 'anthropic', installedVersion: '2.1.300', learned: [] }),
    ).toEqual([]);
  });
});
