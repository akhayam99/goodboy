// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AutoContext } from '@goodboy/core';
import type { RoleModelPreference } from '@goodboy/types';
import { roleResolution } from './roleResolution';

const OPUS_PIN: RoleModelPreference = {
  providerId: 'anthropic',
  model: 'claude-opus-5-5',
  effort: 'high',
};

const CODEX_ONLY: AutoContext = {
  defaultProvider: 'codex',
  connected: ['anthropic', 'codex'],
  policy: [
    { id: 'codex', state: 'on' },
    { id: 'anthropic', state: 'off' },
  ],
};

const CLAUDE_ON: AutoContext = {
  defaultProvider: 'anthropic',
  connected: ['anthropic', 'codex'],
  policy: [
    { id: 'anthropic', state: 'on' },
    { id: 'codex', state: 'off' },
  ],
};

describe('roleResolution', () => {
  it('runs the pin and says nothing while its provider is on', () => {
    const resolution = roleResolution({
      role: 'planner',
      preference: OPUS_PIN,
      autoContext: CLAUDE_ON,
    });

    expect(resolution).toMatchObject({
      provider: 'anthropic',
      model: 'opus-5.5',
      isPinned: true,
      skippedLine: null,
      isPinUnrunnable: false,
    });
  });

  it('names the skipped pin, why, and what runs instead when its provider is off', () => {
    const resolution = roleResolution({
      role: 'planner',
      preference: OPUS_PIN,
      autoContext: CODEX_ONLY,
    });

    expect(resolution.provider).toBe('codex');
    expect(resolution.isPinned).toBe(true);
    expect(resolution.isPinUnrunnable).toBe(true);
    expect(resolution.skippedLine).toMatch(
      /^Pinned Opus 5\.5 is skipped: Claude is Off\. Using [A-Za-z0-9. -]+\.$/,
    );
  });

  it('says the provider is not connected when the pin points at one that is missing', () => {
    const resolution = roleResolution({
      role: 'planner',
      preference: OPUS_PIN,
      autoContext: { defaultProvider: 'codex', connected: ['codex'] },
    });

    expect(resolution.skippedLine).toContain('Claude is not connected');
  });

  it('counts a set whose second model runs as a pin that still works', () => {
    const resolution = roleResolution({
      role: 'planner',
      preference: {
        ...OPUS_PIN,
        models: [
          { providerId: 'anthropic', model: 'claude-opus-5-5' },
          { providerId: 'codex', model: 'gpt-6.1-sol' },
        ],
      },
      autoContext: CODEX_ONLY,
    });

    expect(resolution.provider).toBe('codex');
    expect(resolution.model).toBe('gpt-6.1-sol');
    expect(resolution.isPinUnrunnable).toBe(false);
    expect(resolution.skippedLine).toContain('Pinned Opus 5.5 is skipped');
  });

  it('is plain Auto with no line when the role has no pin', () => {
    const resolution = roleResolution({
      role: 'planner',
      preference: null,
      autoContext: CODEX_ONLY,
    });

    expect(resolution).toMatchObject({
      provider: 'codex',
      isPinned: false,
      skippedLine: null,
      isPinUnrunnable: false,
    });
  });
});
