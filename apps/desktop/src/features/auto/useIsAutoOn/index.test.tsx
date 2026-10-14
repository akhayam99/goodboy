// @vitest-environment happy-dom

const holder = vi.hoisted(() => {
  const state: { db: unknown } = { db: null };
  return state;
});

vi.mock('../../../shared/lib/db', () => ({
  get tauriDatabase() {
    return holder.db;
  },
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { setSetting, type Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import { useAppStore } from '../../../store';
import { SETTING_AUTO_EXPERIMENT } from '../../settings/settings';
import { AutoReleaseContext } from '../autoReleaseContext';
import { useIsAutoOn } from '.';

let db: Database;

const Probe = () => <p>{useIsAutoOn() ? 'auto on' : 'auto off'}</p>;

type MountParams = {
  readonly isReleased: boolean;
};

const mount = ({ isReleased }: MountParams): void => {
  render(
    <AutoReleaseContext.Provider value={isReleased}>
      <Probe />
    </AutoReleaseContext.Provider>,
  );
};

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  holder.db = db;
  useAppStore.setState({ settings: {} });
});

afterEach(cleanup);

describe('useIsAutoOn', () => {
  it('is off until the setting says true', async () => {
    mount({ isReleased: true });

    expect(screen.getByText('auto off')).toBeDefined();
    await setSetting(db, SETTING_AUTO_EXPERIMENT, 'true');
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(screen.getByText('auto on')).toBeDefined());
  });

  it('loads the stored value when it mounts', async () => {
    await setSetting(db, SETTING_AUTO_EXPERIMENT, 'true');

    mount({ isReleased: true });

    await waitFor(() => expect(screen.getByText('auto on')).toBeDefined());
  });

  it('reads the value fresh when the window gets focus again', async () => {
    await setSetting(db, SETTING_AUTO_EXPERIMENT, 'true');
    mount({ isReleased: true });
    await waitFor(() => expect(screen.getByText('auto on')).toBeDefined());

    await setSetting(db, SETTING_AUTO_EXPERIMENT, 'false');
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(screen.getByText('auto off')).toBeDefined());
  });

  it('stays off while the release gate is closed', async () => {
    await setSetting(db, SETTING_AUTO_EXPERIMENT, 'true');

    mount({ isReleased: false });

    await waitFor(() =>
      expect(useAppStore.getState().settings[SETTING_AUTO_EXPERIMENT]).toBe('true'),
    );
    expect(screen.getByText('auto off')).toBeDefined();
  });

  it('is off in the build that ships, whose gate is closed', async () => {
    await setSetting(db, SETTING_AUTO_EXPERIMENT, 'true');

    render(<Probe />);

    await waitFor(() =>
      expect(useAppStore.getState().settings[SETTING_AUTO_EXPERIMENT]).toBe('true'),
    );
    expect(screen.getByText('auto off')).toBeDefined();
  });
});
