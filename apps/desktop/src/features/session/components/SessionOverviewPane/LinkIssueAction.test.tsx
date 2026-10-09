// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, SessionExternalTaskProvider, SessionId } from '@goodboy/types';
import type { LinkWorkItem } from './linkWorkRows';

const { store, work } = vi.hoisted(() => ({
  store: {
    linkSessionExternalTask: vi.fn(async () => undefined),
  },
  work: {
    items: [] as ReadonlyArray<LinkWorkItem>,
    lookedUp: [] as ReadonlyArray<LinkWorkItem>,
    linkedScopes: new Map<string, ReadonlyArray<'session' | 'branch' | 'workspace'>>(),
    sources: [] as ReadonlyArray<SessionExternalTaskProvider>,
    isLoading: false,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

vi.mock('./useLinkWorkItems', () => ({
  useLinkWorkItems: () => work,
}));

vi.mock('../../../integrations/components/IntegrationGlyph', () => ({
  IntegrationGlyph: ({ provider }: { provider: string }) => (
    <span data-testid={`glyph-${provider}`} />
  ),
}));

import { tooltipTextOf } from '../../../../__tests__/helpers/tooltip';
import { LinkIssueAction } from './LinkIssueAction';

const SESSION_ID = 'sess-1' as SessionId;
const session = { id: SESSION_ID, workspaceId: 'ws-1' } as unknown as Session;

const item = ({
  provider,
  identifier,
  title,
  status,
  updatedAt,
}: {
  readonly provider: SessionExternalTaskProvider;
  readonly identifier: string;
  readonly title: string;
  readonly status: string;
  readonly updatedAt: string;
}): LinkWorkItem => ({
  key: `${provider}:${identifier}`,
  task: {
    provider,
    externalId: identifier,
    identifier,
    title,
    url: `https://example.test/${identifier}`,
  },
  status,
  updatedAt,
});

const INBOX_ITEMS: ReadonlyArray<LinkWorkItem> = [
  item({
    provider: 'sentry',
    identifier: 'LEDGER-2M',
    title: 'Timeout in ledger sync job',
    status: 'Unresolved',
    updatedAt: '2026-09-28T08:50:00Z',
  }),
  item({
    provider: 'github',
    identifier: 'notify-relay#88',
    title: 'Retry webhook on 502',
    status: 'Open',
    updatedAt: '2026-09-28T08:00:00Z',
  }),
  item({
    provider: 'linear',
    identifier: 'HAR-219',
    title: 'Checkout totals round the wrong way',
    status: 'Todo',
    updatedAt: '2026-09-28T06:00:00Z',
  }),
  item({
    provider: 'linear',
    identifier: 'HAR-214',
    title: 'Payment sheet loses focus on step change',
    status: 'In progress',
    updatedAt: '2026-09-27T06:00:00Z',
  }),
];

const trigger = () => screen.getByRole('button', { name: 'Link work' });

const search = () => screen.getByRole('combobox', { name: 'Search work to link' });

const optionNames = () =>
  screen.queryAllByRole('option').map((option) => option.getAttribute('aria-label'));

beforeEach(() => {
  store.linkSessionExternalTask.mockClear();
  work.items = INBOX_ITEMS;
  work.lookedUp = [];
  work.linkedScopes = new Map();
  work.sources = ['linear', 'sentry', 'github'];
  work.isLoading = false;
});

afterEach(cleanup);

describe('LinkIssueAction', () => {
  it('names the action on the chip and keeps its L shortcut in the tooltip', () => {
    render(<LinkIssueAction session={session} />);

    expect(trigger().textContent).toBe('Link work');
    expect(tooltipTextOf({ element: trigger() })).toContain('L');
  });

  it('opens on L, never while typing in a field', () => {
    render(
      <>
        <input aria-label="Composer" />
        <LinkIssueAction session={session} />
      </>,
    );

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Composer' }), {
      code: 'KeyL',
      key: 'l',
    });
    expect(screen.queryByRole('combobox', { name: 'Search work to link' })).toBeNull();

    fireEvent.keyDown(document.body, { code: 'KeyL', key: 'l' });
    expect(search()).toBeDefined();
  });

  it('puts the recent inbox items on top, the rest under results', () => {
    render(<LinkIssueAction session={session} />);
    fireEvent.click(trigger());

    expect(screen.getByText('From your inbox')).toBeDefined();
    expect(screen.getByText('Results')).toBeDefined();
    expect(optionNames()).toEqual([
      'Timeout in ledger sync job (LEDGER-2M)',
      'Retry webhook on 502 (notify-relay#88)',
      'Checkout totals round the wrong way (HAR-219)',
      'Payment sheet loses focus on step change (HAR-214)',
    ]);
  });

  it('searches every tracker at once and narrows by source', () => {
    render(<LinkIssueAction session={session} />);
    fireEvent.click(trigger());

    fireEvent.change(search(), { target: { value: 'checkout' } });
    expect(optionNames()).toEqual(['Checkout totals round the wrong way (HAR-219)']);

    fireEvent.change(search(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Sentry' }));
    expect(optionNames()).toEqual(['Timeout in ledger sync job (LEDGER-2M)']);
  });

  it('links the picked item with the same call as the inbox and closes', async () => {
    render(<LinkIssueAction session={session} />);
    fireEvent.click(trigger());

    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    await act(async () => {
      fireEvent.keyDown(search(), { key: 'Enter' });
    });

    expect(store.linkSessionExternalTask).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ provider: 'github', identifier: 'notify-relay#88' }),
    );
    expect(screen.queryByRole('combobox', { name: 'Search work to link' })).toBeNull();
  });

  it('invites a link or a search while the query is empty, and says nothing matched once it is not', () => {
    work.items = [];
    render(<LinkIssueAction session={session} />);
    fireEvent.click(trigger());

    screen.getByText('Paste a link or search');
    expect(screen.queryByText(/matches\./)).toBeNull();

    fireEvent.change(search(), { target: { value: 'zzz' } });
    screen.getByText(/Nothing in .* matches\./);
    expect(screen.queryByText('Paste a link or search')).toBeNull();
  });

  it('hides a task linked to every scope', () => {
    work.linkedScopes = new Map([['sentry:LEDGER-2M', ['session', 'branch', 'workspace']]]);
    render(<LinkIssueAction session={session} />);
    fireEvent.click(trigger());

    expect(optionNames()).not.toContain('Timeout in ledger sync job (LEDGER-2M)');
  });

  it('links a pasted URL even with no tracker connected', async () => {
    work.items = [];
    work.sources = [];
    render(<LinkIssueAction session={session} />);
    fireEvent.click(trigger());

    expect(search().getAttribute('placeholder')).toBe('Paste a link to an issue');
    fireEvent.change(search(), {
      target: { value: 'https://linear.app/harborline/issue/HAR-230/refund-copy' },
    });
    expect(optionNames()).toEqual(['Link HAR-230']);
    await act(async () => {
      fireEvent.keyDown(search(), { key: 'Enter' });
    });

    expect(store.linkSessionExternalTask).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ provider: 'linear', identifier: 'HAR-230' }),
    );
  });

  it('says which links it knows when the host is unknown', () => {
    render(<LinkIssueAction session={session} />);
    fireEvent.click(trigger());

    fireEvent.change(search(), { target: { value: 'https://example.test/some/page' } });

    expect(screen.getByText(/^Goodboy links Linear, Sentry/)).toBeDefined();
    expect(optionNames()).toEqual([]);
  });

  it('opens under the chip with its right edges aligned', () => {
    const rectOf = (element: Element): DOMRect => {
      const isTrigger = element.querySelector('button[aria-label="Link work"]') !== null;
      const left = isTrigger ? 900 : 0;
      const width = isTrigger ? 120 : 480;
      return {
        x: left,
        y: 40,
        left,
        top: 40,
        right: left + width,
        bottom: 68,
        width,
        height: 28,
        toJSON: () => ({}),
      };
    };
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        return rectOf(this);
      });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    render(<LinkIssueAction session={session} />);
    fireEvent.click(trigger());

    const panel = screen.getByRole('dialog', { name: 'Link work' });
    expect(panel.style.left).toBe('540px');
    spy.mockRestore();
  });
});
