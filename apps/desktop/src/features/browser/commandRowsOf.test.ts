import { describe, expect, it } from 'vitest';
import { nextProjectId, nextSessionId } from '@goodboy/types/testing';
import type { BrowserTab } from '../../store/slices/browser/types';
import type { BrowserVisit } from '../../store/slices/browser-visits/types';
import { commandRowsOf } from './commandRowsOf';
import type { BrowserPageGroup, CommandRows } from './types';

const HERE = nextSessionId();
const SIBLING = nextSessionId();
const PAYMENTS_API = nextProjectId();

type TabParams = {
  readonly id: string;
  readonly url: string;
  readonly title: string;
};

type TextParams = {
  readonly text: string;
};

const tabOf = ({ id, url, title }: TabParams): BrowserTab => ({
  id,
  sessionId: null,
  projectId: null,
  url,
  title,
  position: 0,
  createdAt: 1,
  updatedAt: 1,
});

const CHECKOUT = tabOf({ id: 'checkout', url: 'http://localhost:5173/checkout', title: '' });
const TAX = tabOf({ id: 'tax', url: 'http://localhost:5173/tax', title: 'Tax rates' });
const PR = tabOf({ id: 'pr', url: 'https://northwind.example/pr/318', title: 'PR #318' });
const STAGING = tabOf({
  id: 'staging',
  url: 'https://staging.harborline.test/checkout',
  title: 'Staging checkout',
});

const GROUPS: ReadonlyArray<BrowserPageGroup> = [
  { key: 'sibling', label: 'Fix notify-relay', sessionId: SIBLING, tabs: [PR], isPins: false },
  { key: 'pins', label: 'Pinned for payments-api', sessionId: HERE, tabs: [STAGING], isPins: true },
  { key: 'here', label: 'Ship ledger-core', sessionId: HERE, tabs: [CHECKOUT, TAX], isPins: false },
];

const VISITS: ReadonlyArray<BrowserVisit> = [
  { url: 'http://localhost:5173/checkout/confirm', title: 'Confirm order', visitedAt: 3 },
  { url: 'http://localhost:5173/checkout', title: 'Checkout', visitedAt: 2 },
  { url: 'https://acme.example/', title: '', visitedAt: 1 },
];

const rowsFor = ({ text }: TextParams): CommandRows =>
  commandRowsOf({
    text,
    groups: GROUPS,
    visits: VISITS,
    sessionId: HERE,
    titleOf: ({ tab }) => (tab.id === 'checkout' ? 'Checkout' : tab.title),
  });

const keysOf = ({ text }: TextParams) =>
  rowsFor({ text }).groups.map((group) => [group.label, group.rows.map((row) => row.key)]);

describe('commandRowsOf', () => {
  it('puts a typed address first, beside the session then in your browser', () => {
    const rows = rowsFor({ text: 'localhost:8080' });

    expect(rows.groups[0]?.label).toBe('Open');
    expect(rows.groups[0]?.rows).toEqual([
      { kind: 'open', key: 'open', url: 'http://localhost:8080/', label: 'localhost:8080' },
      { kind: 'outside', key: 'outside', url: 'http://localhost:8080/', label: 'localhost:8080' },
    ]);
    expect(rows.hasNoMatch).toBe(false);
  });

  it('matches a word against tabs of every session, this one first, and skips visits of a listed tab', () => {
    expect(keysOf({ text: 'check' })).toEqual([
      ['Tabs', ['tab:checkout', 'tab:staging']],
      ['Visited', ['visit:http://localhost:5173/checkout/confirm']],
    ]);
    expect(keysOf({ text: 'northwind' })).toEqual([['Tabs', ['tab:pr']]]);
    expect(keysOf({ text: 'northwind.example' })).toEqual([
      ['Open', ['open', 'outside']],
      ['Tabs', ['tab:pr']],
    ]);
  });

  it('tags a pin and names the session of a tab that is not this one', () => {
    const tabs = rowsFor({ text: 'checkout' }).groups[0]?.rows ?? [];
    const pr = rowsFor({ text: 'PR' }).groups.find((group) => group.label === 'Tabs')?.rows[0];

    expect(tabs[1]).toMatchObject({ kind: 'tab', isPin: true, place: null, isHere: true });
    expect(tabs[0]).toMatchObject({ kind: 'tab', title: 'Checkout', isHere: true, place: null });
    expect(pr).toMatchObject({
      kind: 'tab',
      title: 'PR #318',
      address: 'northwind.example/pr/318',
      sessionId: SIBLING,
      place: 'Fix notify-relay',
      isHere: false,
      isPin: false,
    });
  });

  it('needs every word to match the title, host or path', () => {
    expect(keysOf({ text: 'tax localhost' })).toEqual([['Tabs', ['tab:tax']]]);
    expect(keysOf({ text: 'confirm order' })).toEqual([
      ['Visited', ['visit:http://localhost:5173/checkout/confirm']],
    ]);
  });

  it('shows one quiet line and no group for words that match nothing', () => {
    expect(rowsFor({ text: 'checkout total' })).toEqual({ groups: [], hasNoMatch: true });
  });

  it('lists the visits of this session, newest first, when nothing is typed', () => {
    const rows = rowsFor({ text: '  ' });

    expect(rows.hasNoMatch).toBe(false);
    expect(keysOf({ text: '' })).toEqual([
      [
        'Visited',
        [
          'visit:http://localhost:5173/checkout/confirm',
          'visit:http://localhost:5173/checkout',
          'visit:https://acme.example/',
        ],
      ],
    ]);
    expect(rows.groups[0]?.rows[2]).toMatchObject({
      title: 'acme.example',
      address: 'acme.example',
    });
  });
});
