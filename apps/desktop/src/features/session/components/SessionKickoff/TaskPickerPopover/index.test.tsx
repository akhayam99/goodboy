// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import type { InboxProvider, InboxRecord } from '../../../../inbox/types';
import type { IssueCandidate } from '../../../../integrations/fetchIssueCandidates';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { taskPickerRecord } from './testing/taskPickerRecord';
import { TaskPickerPopover } from '.';

const HARBORLINE = aWorkspace({ name: 'Harborline' }).id;
const NORTHWIND = aWorkspace({ name: 'Northwind', slug: 'northwind' }).id;
const CONNECTED: ReadonlyArray<InboxProvider> = ['github', 'linear', 'sentry'];
const IDLE: Readonly<Record<InboxProvider, boolean>> = {
  github: false,
  gitlab: false,
  linear: false,
  jira: false,
  sentry: false,
  slack: false,
  bitbucket: false,
};
const NO_ERRORS: Readonly<Record<InboxProvider, string | null>> = {
  github: null,
  gitlab: null,
  linear: null,
  jira: null,
  sentry: null,
  slack: null,
  bitbucket: null,
};

type AgoParams = {
  readonly minutes: number;
};

const ago = ({ minutes }: AgoParams): string =>
  new Date(Date.now() - minutes * 60_000).toISOString();

const RECORDS: ReadonlyArray<InboxRecord> = [
  taskPickerRecord({
    provider: 'linear',
    id: 'HBL-412',
    title: 'Ledger export times out over 10k rows',
    updatedAt: ago({ minutes: 20 }),
  }),
  taskPickerRecord({
    provider: 'linear',
    id: 'HBL-407',
    title: 'Refund runs twice on a retried charge',
    updatedAt: ago({ minutes: 90 }),
  }),
  taskPickerRecord({
    provider: 'github',
    id: '#418',
    title: 'Stream the ledger export',
    updatedAt: ago({ minutes: 45 }),
    context: 'harborline/payments-api',
  }),
  taskPickerRecord({
    provider: 'sentry',
    id: 'NOTIFY-RELAY-2F',
    title: 'TypeError in webhook relay',
    updatedAt: ago({ minutes: 5 }),
    context: 'relay/deliver.ts',
  }),
];

type MountParams = {
  readonly workspaceId?: WorkspaceId;
  readonly records?: ReadonlyArray<InboxRecord>;
  readonly loading?: Readonly<Record<InboxProvider, boolean>>;
  readonly errors?: Readonly<Record<InboxProvider, string | null>>;
  readonly onRetry?: () => void;
  readonly onPick?: (candidate: IssueCandidate) => void;
};

const pickerOf = ({
  workspaceId = HARBORLINE,
  records = RECORDS,
  loading = IDLE,
  errors = NO_ERRORS,
  onRetry = () => undefined,
  onPick = () => undefined,
}: MountParams) => (
  <TaskPickerPopover
    workspaceId={workspaceId}
    records={records}
    connected={CONNECTED}
    loading={loading}
    errors={errors}
    isDisabled={false}
    onRetry={onRetry}
    onPick={onPick}
  />
);

const open = (): void => {
  fireEvent.click(screen.getByRole('combobox', { name: 'Pick from Tasks' }));
};

const search = (): HTMLElement => screen.getByRole('combobox', { name: 'Search tasks' });

const optionNames = (): ReadonlyArray<string | null> =>
  within(screen.getByRole('listbox', { name: 'Tasks' }))
    .queryAllByRole('option')
    .map((option) => option.getAttribute('aria-label'));

const sourceTab = (name: RegExp): HTMLElement =>
  within(screen.getByRole('tablist', { name: 'Task sources' })).getByRole('tab', { name });

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('TaskPickerPopover', () => {
  it('groups open tasks by source under All, with a count on every source', () => {
    render(pickerOf({}));
    open();

    expect(document.activeElement).toBe(search());
    expect(sourceTab(/^All/).getAttribute('aria-selected')).toBe('true');
    expect(sourceTab(/^All/).textContent).toContain('4');
    expect(sourceTab(/^Linear/).textContent).toContain('2');
    expect(optionNames()).toEqual([
      '#418 Stream the ledger export',
      'HBL-412 Ledger export times out over 10k rows',
      'HBL-407 Refund runs twice on a retried charge',
      'NOTIFY-RELAY-2F TypeError in webhook relay',
    ]);
  });

  it('filters by one source', () => {
    render(pickerOf({}));
    open();

    fireEvent.click(sourceTab(/^Sentry/));

    expect(optionNames()).toEqual(['NOTIFY-RELAY-2F TypeError in webhook relay']);
  });

  it('searches within the picked source', () => {
    render(pickerOf({}));
    open();

    fireEvent.click(sourceTab(/^Linear/));
    fireEvent.change(search(), { target: { value: 'export' } });

    expect(optionNames()).toEqual(['HBL-412 Ledger export times out over 10k rows']);
    expect(sourceTab(/^GitHub/).textContent).toContain('1');
    fireEvent.change(search(), { target: { value: 'nothing like it' } });
    screen.getByText('No task matches "nothing like it"');
  });

  it('moves with the arrows, picks with Enter and closes', () => {
    const onPick = vi.fn<(candidate: IssueCandidate) => void>();
    render(pickerOf({ onPick }));
    open();

    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    fireEvent.keyDown(search(), { key: 'ArrowUp' });
    fireEvent.keyDown(search(), { key: 'Enter' });

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0]?.[0]).toMatchObject({ provider: 'linear', identifier: 'HBL-412' });
    expect(screen.queryByRole('listbox', { name: 'Tasks' })).toBeNull();
  });

  it('keeps the cursor on the same task when a source answers late', () => {
    const onPick = vi.fn<(candidate: IssueCandidate) => void>();
    const { rerender } = render(pickerOf({ records: RECORDS.slice(0, 2), onPick }));
    open();
    fireEvent.change(search(), { target: { value: 'r' } });
    fireEvent.keyDown(search(), { key: 'ArrowDown' });

    rerender(pickerOf({ records: RECORDS, onPick }));
    expect(search()).toHaveProperty('value', 'r');
    expect(optionNames()).toHaveLength(4);
    fireEvent.keyDown(search(), { key: 'Enter' });

    expect(onPick.mock.calls[0]?.[0]).toMatchObject({ identifier: 'HBL-407' });
  });

  it('shows a failed source inline with Retry and keeps the others', () => {
    const onRetry = vi.fn();
    render(
      pickerOf({
        errors: { ...NO_ERRORS, linear: 'Linear is unreachable' },
        onRetry,
        records: RECORDS.filter((record) => record.provider !== 'linear'),
      }),
    );
    open();

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain("Couldn't load Linear tasks");
    within(sourceTab(/^Linear/)).getByLabelText("Didn't load");
    expect(optionNames()).toHaveLength(2);
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows rows that load as a skeleton, never an empty line', () => {
    render(
      pickerOf({ records: [], loading: { ...IDLE, linear: true, github: true, sentry: true } }),
    );
    open();

    expect(screen.getAllByRole('status', { name: 'Loading tasks' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('No open tasks in this workspace')).toBeNull();
  });

  it('remembers the source per workspace', () => {
    render(pickerOf({}));
    open();
    fireEvent.click(sourceTab(/^Sentry/));
    cleanup();

    render(pickerOf({}));
    open();
    expect(sourceTab(/^Sentry/).getAttribute('aria-selected')).toBe('true');
    expect(optionNames()).toEqual(['NOTIFY-RELAY-2F TypeError in webhook relay']);
    cleanup();

    render(pickerOf({ workspaceId: NORTHWIND }));
    open();
    expect(sourceTab(/^All/).getAttribute('aria-selected')).toBe('true');
  });

  it('reaches the sources with Tab and switches them with the arrows', () => {
    render(pickerOf({}));
    open();

    fireEvent.keyDown(search(), { key: 'Tab' });
    expect(document.activeElement).toBe(sourceTab(/^All/));
    fireEvent.keyDown(sourceTab(/^All/), { key: 'ArrowRight' });
    expect(sourceTab(/^GitHub/).getAttribute('aria-selected')).toBe('true');
    expect(optionNames()).toEqual(['#418 Stream the ledger export']);
    fireEvent.keyDown(sourceTab(/^GitHub/), { key: 'Tab' });
    expect(document.activeElement).toBe(search());
  });
});
