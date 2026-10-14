// @vitest-environment happy-dom

const holder = vi.hoisted(() => {
  const state: { db: Database | null } = { db: null };
  return state;
});

vi.mock('../../../shared/lib/db', () => ({
  get tauriDatabase() {
    return holder.db;
  },
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import { setSetting, type Database } from '@goodboy/db';
import { brandId, type SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { SETTING_AUTO_EXPERIMENT } from '../../settings/settings';
import { AutoReleaseContext } from '../autoReleaseContext';
import { talkItThroughGoal } from '../talkItThroughGoal';
import { useTalkItThrough } from '.';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });

const Probe = () => {
  const talk = useTalkItThrough({ sessionId: SESSION });
  return (
    <button
      type="button"
      disabled={!talk.isAvailable}
      onClick={() =>
        talk.talk({ title: 'Implement the retry guard', detail: 'The plan is approved' })
      }
    >
      talk
    </button>
  );
};

beforeEach(async () => {
  holder.db = await makeMigratedTestDatabase();
  useAppStore.setState({ settings: {}, newDrawerDrafts: {}, drawer: null });
});

afterEach(cleanup);

describe('useTalkItThrough', () => {
  it('seeds the Auto goal of the drawer with the card and opens the Agent tab, without starting', async () => {
    if (holder.db === null) {
      throw new Error('no database');
    }
    await setSetting(holder.db, SETTING_AUTO_EXPERIMENT, 'true');
    render(
      <AutoReleaseContext.Provider value>
        <Probe />
      </AutoReleaseContext.Provider>,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'talk' })).toHaveProperty('disabled', false),
    );

    fireEvent.click(screen.getByRole('button', { name: 'talk' }));

    expect(useAppStore.getState().newDrawerDrafts[SESSION]?.autoGoal).toBe(
      talkItThroughGoal({ title: 'Implement the retry guard', detail: 'The plan is approved' }),
    );
    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'new',
      sessionId: SESSION,
      payload: { tab: 'agent' },
    });
  });

  it('is not available while the experiment is off', () => {
    render(
      <AutoReleaseContext.Provider value>
        <Probe />
      </AutoReleaseContext.Provider>,
    );

    expect(screen.getByRole('button', { name: 'talk' })).toHaveProperty('disabled', true);
  });

  it('puts the card in the goal and tells Auto to talk before it starts any work', () => {
    const goal = talkItThroughGoal({ title: 'Test the retry path', detail: null });

    expect(goal).toContain('before you start any work');
    expect(goal.endsWith('Test the retry path')).toBe(true);
  });
});
