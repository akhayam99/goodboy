// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveSlot, type ResolveContext } from '@goodboy/core';
import type { RoleModelPreference } from '@goodboy/types';
import { isPinUnrunnable, isResolutionNoted, resolutionNote } from './resolutionNote';

const OPUS_PIN: RoleModelPreference = {
  providerId: 'anthropic',
  model: 'claude-opus-5-5',
  effort: 'high',
};

const CODEX_ONLY: ResolveContext = {
  defaultProvider: 'codex',
  connected: ['anthropic', 'codex'],
  policy: [
    { id: 'codex', state: 'on' },
    { id: 'anthropic', state: 'off' },
  ],
};

const CLAUDE_ON: ResolveContext = {
  defaultProvider: 'anthropic',
  connected: ['anthropic', 'codex'],
  policy: [
    { id: 'anthropic', state: 'on' },
    { id: 'codex', state: 'off' },
  ],
};

type PlannerParams = {
  readonly preference: RoleModelPreference | null;
  readonly context: ResolveContext;
};

const planner = ({ preference, context }: PlannerParams) =>
  resolveSlot({
    slot: { kind: 'role', id: 'planner' },
    layers: { workspace: preference === null ? null : { roleModels: { planner: preference } } },
    context,
  });

describe('resolutionNote', () => {
  it('runs the pin and says nothing while its provider is on', () => {
    const resolution = planner({ preference: OPUS_PIN, context: CLAUDE_ON });

    expect(resolution).toMatchObject({ provider: 'anthropic', model: 'opus-5.5' });
    expect(resolutionNote({ resolution })).toBeNull();
    expect(isPinUnrunnable({ resolution })).toBe(false);
  });

  it('names the skipped pin, why, and what runs instead when its provider is off', () => {
    const resolution = planner({ preference: OPUS_PIN, context: CODEX_ONLY });

    expect(resolution.provider).toBe('codex');
    expect(isPinUnrunnable({ resolution })).toBe(true);
    expect(resolutionNote({ resolution })).toMatch(
      /^Pinned Opus 5\.5 is skipped: Claude is Off\. Using [A-Za-z0-9. -]+\.$/,
    );
  });

  it('says the provider is not connected when the pin points at one that is missing', () => {
    const resolution = planner({
      preference: OPUS_PIN,
      context: { defaultProvider: 'codex', connected: ['codex'] },
    });

    expect(resolutionNote({ resolution })).toContain('Claude is not connected');
  });

  it('counts a set whose second model runs as a pin that still works', () => {
    const resolution = planner({
      preference: {
        ...OPUS_PIN,
        models: [
          { providerId: 'anthropic', model: 'claude-opus-5-5' },
          { providerId: 'codex', model: 'gpt-6.1-sol' },
        ],
      },
      context: CODEX_ONLY,
    });

    expect(resolution).toMatchObject({ provider: 'codex', model: 'gpt-6.1-sol' });
    expect(isPinUnrunnable({ resolution })).toBe(false);
    expect(resolutionNote({ resolution })).toContain('Pinned Opus 5.5 is skipped');
  });

  it('is plain Auto with no note when the role has no pin', () => {
    const resolution = planner({ preference: null, context: CODEX_ONLY });

    expect(resolution).toMatchObject({ provider: 'codex', source: 'auto' });
    expect(isResolutionNoted({ resolution })).toBe(false);
    expect(resolutionNote({ resolution })).toBeNull();
    expect(isPinUnrunnable({ resolution })).toBe(false);
  });

  it('prints the project whose pin wins inside it', () => {
    const resolution = resolveSlot({
      slot: { kind: 'task', id: 'summarizer' },
      layers: {
        workspace: {},
        scoped: [
          {
            kind: 'project',
            name: 'payments-api',
            layer: {
              taskModels: { summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-5' } },
            },
          },
        ],
      },
      context: CLAUDE_ON,
    });

    expect(isResolutionNoted({ resolution })).toBe(true);
    expect(resolutionNote({ resolution })).toBe(
      'A project setting in payments-api overrides this: Sonnet 4.5.',
    );
  });
});
