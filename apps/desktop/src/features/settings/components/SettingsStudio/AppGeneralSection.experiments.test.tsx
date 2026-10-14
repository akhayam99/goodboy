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

describe('General page and the Experiments band', () => {
  it('puts Experiments below Search with the Auto agent row', () => {
    mount({ isReleased: true });

    const headings = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent);
    expect(headings.indexOf('Experiments')).toBeGreaterThan(headings.indexOf('Search'));
    expect(screen.getByRole('switch', { name: 'Auto agent' })).toBeDefined();
  });

  it('has no Experiments band while the release gate is closed', () => {
    mount({ isReleased: false });

    expect(screen.queryByRole('heading', { name: 'Experiments' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Auto agent' })).toBeNull();
  });

  it('has none in the build that ships, whose gate is closed', () => {
    render(<AppGeneralSection />);

    expect(screen.queryByRole('heading', { name: 'Experiments' })).toBeNull();
  });
});
