import { describe, expect, it } from 'vitest';
import type { BrowserTab } from '../../store/slices/browser/types';
import { tabForAddress } from './tabForAddress';

type TabParams = {
  readonly id: string;
  readonly url: string;
};

const tabOf = ({ id, url }: TabParams): BrowserTab => ({
  id,
  sessionId: null,
  projectId: null,
  url,
  title: '',
  position: 0,
  createdAt: 1,
  updatedAt: 1,
});

const TABS = [
  tabOf({ id: 'docs', url: 'https://docs.harborline.dev/tax' }),
  tabOf({ id: 'checkout', url: 'http://localhost:5173/checkout' }),
  tabOf({ id: 'home', url: 'http://localhost:5173/' }),
];

describe('tabForAddress', () => {
  it('finds the tab on the same address, trailing slash or not', () => {
    expect(tabForAddress({ tabs: TABS, url: 'http://localhost:5173/checkout' })?.id).toBe(
      'checkout',
    );
    expect(tabForAddress({ tabs: TABS, url: 'http://localhost:5173' })?.id).toBe('home');
  });

  it('takes any tab on the server for the bare server address', () => {
    expect(tabForAddress({ tabs: TABS.slice(0, 2), url: 'http://localhost:5173' })?.id).toBe(
      'checkout',
    );
  });

  it('opens a new tab for another page or another server', () => {
    expect(tabForAddress({ tabs: TABS, url: 'http://localhost:5173/cart' })).toBeNull();
    expect(tabForAddress({ tabs: TABS, url: 'http://localhost:4310' })).toBeNull();
    expect(tabForAddress({ tabs: TABS, url: 'not an address' })).toBeNull();
  });
});
