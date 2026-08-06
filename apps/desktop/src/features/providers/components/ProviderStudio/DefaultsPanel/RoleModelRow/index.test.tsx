import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { resolveRoleRouting } from '@goodboy/core';
import type { ProviderId, RoleModelPreference } from '@goodboy/types';
import { RoleModelRow } from './index';

const CONNECTED = ['anthropic', 'cursor'] satisfies ReadonlyArray<ProviderId>;

type RenderParams = {
  readonly preference: RoleModelPreference | null;
  readonly onChange: (preference: RoleModelPreference | null) => void;
};

const renderRow = ({ preference, onChange }: RenderParams) =>
  render(
    <RoleModelRow
      role="planner"
      label="Planner"
      help="plans the work"
      preference={preference}
      defaultProviderId="anthropic"
      connectedProviderIds={CONNECTED}
      disabled={false}
      onChange={onChange}
    />,
  );

const openPrimary = () =>
  fireEvent.click(screen.getByRole('button', { name: /^Planner routing:/ }));

const openFallback = () =>
  fireEvent.click(screen.getByRole('button', { name: /^Planner fallback routing:/ }));

const pickProvider = (label: string) =>
  fireEvent.click(screen.getByRole('button', { name: label }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('RoleModelRow', () => {
  it('moves a pinned role to another provider in one click', () => {
    const onChange = vi.fn<(preference: RoleModelPreference | null) => void>();
    renderRow({
      preference: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'high' },
      onChange,
    });

    openPrimary();
    pickProvider('Cursor');

    expect(onChange).not.toHaveBeenCalledWith(null);
    for (const [preference] of onChange.mock.calls) {
      expect(preference?.providerId).toBe('cursor');
    }
    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
      providerId: 'cursor',
      model: 'opus-5',
    });
  });

  it('pins a role running on its compiled default to the provider picked', () => {
    const onChange = vi.fn<(preference: RoleModelPreference | null) => void>();
    renderRow({ preference: null, onChange });

    openPrimary();
    pickProvider('Cursor');

    expect(onChange).not.toHaveBeenCalledWith(null);
    expect(onChange.mock.calls.at(-1)?.[0]?.providerId).toBe('cursor');
  });

  it('emits no preference the registry has to throw away', () => {
    const onChange = vi.fn<(preference: RoleModelPreference | null) => void>();
    renderRow({
      preference: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'high' },
      onChange,
    });

    openPrimary();
    pickProvider('Cursor');

    expect(onChange.mock.calls.length).toBeGreaterThan(0);
    for (const [preference] of onChange.mock.calls) {
      expect(preference).not.toBeNull();
      const routed = resolveRoleRouting({
        role: 'planner',
        prefs: preference == null ? null : { planner: preference },
      });
      expect(routed.isOverride).toBe(true);
      expect(routed.provider).toBe(preference?.providerId);
    }
  });

  it('carries the fallback across a provider switch instead of dropping it', () => {
    const onChange = vi.fn<(preference: RoleModelPreference | null) => void>();
    renderRow({
      preference: {
        providerId: 'anthropic',
        model: 'claude-opus-5',
        effort: 'high',
        fallback: { providerId: 'anthropic', model: 'haiku-4.5' },
      },
      onChange,
    });

    openPrimary();
    pickProvider('Cursor');

    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
      providerId: 'cursor',
      fallback: { providerId: 'anthropic', model: 'haiku-4.5' },
    });
  });

  it('pins the fallback to the provider the user picked, not to a global model owner', () => {
    const onChange = vi.fn<(preference: RoleModelPreference | null) => void>();
    renderRow({
      preference: {
        providerId: 'anthropic',
        model: 'claude-opus-5',
        effort: 'high',
        fallback: { providerId: 'anthropic', model: 'haiku-4.5' },
      },
      onChange,
    });

    openFallback();
    pickProvider('Cursor');

    expect(onChange).not.toHaveBeenCalledWith(null);
    expect(onChange.mock.calls.at(-1)?.[0]?.fallback?.providerId).toBe('cursor');
  });
});
