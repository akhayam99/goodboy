import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { GitMerge, Send, Unlink, XCircle } from 'lucide-react';
import type { RecordFrame, RecordVerb, RecordVerbs } from '../RecordActions/types';
import { RecordHeader } from './index';

afterEach(cleanup);

const verb = (overrides: Partial<RecordVerb> & Pick<RecordVerb, 'key' | 'label'>): RecordVerb => ({
  icon: Send,
  onRun: vi.fn(),
  isBusy: false,
  blockedReason: null,
  confirm: null,
  ...overrides,
});

const VERBS: RecordVerbs = {
  secondary: [
    verb({
      key: 'merge',
      label: 'Merge',
      icon: GitMerge,
      confirm: {
        title: 'Merge !87?',
        description: 'It cannot be undone.',
        confirmLabel: 'Confirm merge',
      },
    }),
  ],
  overflow: [verb({ key: 'draft', label: 'Convert to draft' })],
  destructive: [
    verb({
      key: 'close',
      label: 'Close merge request',
      icon: XCircle,
      confirm: {
        title: 'Close !87?',
        description: 'You can reopen it.',
        confirmLabel: 'Confirm close',
      },
    }),
  ],
};

const frame = (overrides: Partial<RecordFrame> = {}): RecordFrame => ({
  primary: <button type="button">Launch session</button>,
  sessionVerbs: [verb({ key: 'unlink', label: 'Unlink session', icon: Unlink })],
  onRefresh: vi.fn(),
  onClose: vi.fn(),
  ...overrides,
});

const EXTERNAL = {
  url: 'https://gitlab.com/harborline/ledger-core/-/merge_requests/87',
  label: 'MR',
};

describe('RecordHeader', () => {
  it('reads identity, title, then one primary before the secondaries', () => {
    render(
      <RecordHeader
        provider="gitlab"
        identifier="!87"
        title="Batch settlement writes in ledger-core"
        state={<span>Open</span>}
        externalRef={EXTERNAL}
        verbs={VERBS}
        frame={frame()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Batch settlement writes in ledger-core' }),
    ).toBeDefined();
    expect(screen.getByText('!87')).toBeDefined();
    expect(screen.getByText('Open')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open in GitLab' })).toBeDefined();
    const row = screen.getByRole('button', { name: 'Launch session' }).parentElement as HTMLElement;
    expect(
      within(row)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Launch session', 'Merge']);
  });

  it('orders the overflow: tool verbs, refresh, copy link, session, then destructive', () => {
    render(
      <RecordHeader
        provider="gitlab"
        identifier="!87"
        title="Batch settlement writes"
        externalRef={EXTERNAL}
        verbs={VERBS}
        frame={frame()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'More actions for !87' }));

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Convert to draft',
      'Refresh',
      'Copy link',
      'Unlink session',
      'Close merge request…',
    ]);
  });

  it('asks before a destructive verb from the menu and runs it only on confirm', async () => {
    const onRun = vi.fn(async () => undefined);
    render(
      <RecordHeader
        provider="gitlab"
        identifier="!87"
        title="Batch settlement writes"
        verbs={{ ...VERBS, destructive: [{ ...(VERBS.destructive[0] as RecordVerb), onRun }] }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'More actions for !87' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Close merge request…' }));
    expect(onRun).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Close !87?' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm close' }));

    await waitFor(() => expect(onRun).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Close !87?' })).toBeNull());
  });

  it('keeps a blocked secondary visible and inert', () => {
    const onRun = vi.fn();
    render(
      <RecordHeader
        provider="bitbucket"
        identifier="#44"
        title="Retry settled batches"
        verbs={{
          secondary: [
            verb({ key: 'approve', label: 'Approve', onRun, blockedReason: 'Not yours' }),
          ],
          overflow: [],
          destructive: [],
        }}
      />,
    );

    const approve = screen.getByRole('button', { name: 'Approve' });
    expect(approve.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(approve);
    expect(onRun).not.toHaveBeenCalled();
  });

  it('closes from the identity line only when a frame asks for it', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <RecordHeader
        provider="linear"
        identifier="CAS-231"
        title="Refunds"
        frame={frame({ onClose })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close the item' }));
    expect(onClose).toHaveBeenCalledOnce();
    unmount();

    render(<RecordHeader provider="linear" identifier="CAS-231" title="Refunds" />);
    expect(screen.queryByRole('button', { name: 'Close the item' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More actions for CAS-231' })).toBeNull();
  });
});
