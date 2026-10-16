// @vitest-environment happy-dom

const holder = vi.hoisted(() => {
  const state: { db: unknown } = { db: null };
  return state;
});

vi.mock('../../../../shared/lib/db', () => ({
  get tauriDatabase() {
    return holder.db;
  },
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import { useAppStore } from '../../../../store';
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';
import { AppGeneralSection } from './AppGeneralSection';

type MountParams = {
  readonly isReleased: boolean;
};

const mount = ({ isReleased }: MountParams): void => {
  render(
    <AutoReleaseContext.Provider value={isReleased}>
      <AppGeneralSection />
    </AutoReleaseContext.Provider>,
  );
};

beforeEach(async () => {
  holder.db = await makeMigratedTestDatabase();
  useAppStore.setState({
    settings: {},
    detectedEditors: [],
    detectedBrowsers: [],
    loadDetectedEditors: async () => undefined,
    loadDetectedBrowsers: async () => undefined,
  });
});

afterEach(cleanup);

describe('General page without an Auto switch', () => {
  it.each([true, false])(
    'has no Experiments band and no Auto switch, release gate open %s',
    (isReleased) => {
      mount({ isReleased });

      expect(screen.getByRole('heading', { name: 'Search' })).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'Experiments' })).toBeNull();
      expect(screen.queryByRole('switch', { name: 'Auto agent' })).toBeNull();
    },
  );
});
