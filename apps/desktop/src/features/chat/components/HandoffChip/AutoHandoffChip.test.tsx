// @vitest-environment happy-dom

const holder = vi.hoisted(() => {
  const state: { db: Database | null } = { db: null };
  return state;
});

vi.mock('../../../../shared/lib/db', () => ({
  get tauriDatabase() {
    return holder.db;
  },
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { setSetting, type Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import { brandId, type AgentId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { MOVE_TO_AUTO_EVENT } from '../../../auto/adopt/moveToAutoEvent';
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';
import { SETTING_AUTO_EXPERIMENT } from '../../../settings/settings';
import { AutoHandoffChip } from './AutoHandoffChip';

const dbOf = (): Database => {
  if (holder.db === null) {
    throw new Error('no database');
  }
  return holder.db;
};

const AGENT = brandId<AgentId>({ value: 'agent-source' });

beforeEach(async () => {
  holder.db = await makeMigratedTestDatabase();
  useAppStore.setState({ settings: {} });
});

afterEach(cleanup);

type MountParams = {
  readonly isReleased?: boolean;
};

const mount = ({ isReleased = true }: MountParams = {}): void => {
  render(
    <AutoReleaseContext.Provider value={isReleased}>
      <AutoHandoffChip reason="Needs a tester and a reviewer" agentId={AGENT} />
    </AutoReleaseContext.Provider>,
  );
};

describe('the chip where an agent suggests Auto', () => {
  it('shows nothing while the experiment is off', async () => {
    mount();

    expect(screen.queryByText('Agent suggests: Auto')).toBeNull();
  });

  it('shows the reason and asks the pane to open the Move to Auto panel', async () => {
    await setSetting(dbOf(), SETTING_AUTO_EXPERIMENT, 'true');
    const heard: Array<unknown> = [];
    const listen = (event: Event) => {
      heard.push(event instanceof CustomEvent ? event.detail : null);
    };
    window.addEventListener(MOVE_TO_AUTO_EVENT, listen);
    mount();

    expect(await screen.findByText('Agent suggests: Auto')).toBeDefined();
    expect(screen.getByText('Needs a tester and a reviewer')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Move to Auto' }));
    window.removeEventListener(MOVE_TO_AUTO_EVENT, listen);

    await waitFor(() => expect(heard).toEqual([{ agentId: AGENT }]));
  });

  it('stays hidden while the release gate is closed, whatever is stored', async () => {
    await setSetting(dbOf(), SETTING_AUTO_EXPERIMENT, 'true');
    mount({ isReleased: false });

    await waitFor(() =>
      expect(useAppStore.getState().settings[SETTING_AUTO_EXPERIMENT]).toBe('true'),
    );
    expect(screen.queryByText('Agent suggests: Auto')).toBeNull();
  });
});
