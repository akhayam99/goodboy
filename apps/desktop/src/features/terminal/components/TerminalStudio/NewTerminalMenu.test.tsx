// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { brandedId } from '../../../history/testing/brandedId';
import type { PickerCluster, PickerRow } from '../../terminalPickerClusters';
import { TERMINAL_PICKER_EVENTS } from '../../terminalPickerEvents';
import { NewTerminalMenu } from './NewTerminalMenu';

afterEach(cleanup);

const SESSION_ID = brandedId<SessionId>({ value: 'session-ledger-export' });

type RowParams = {
  readonly key: string;
  readonly name: string;
  readonly branch: string;
  readonly path: string;
};

const row = ({ key, name, branch, path }: RowParams): PickerRow => ({
  key,
  kind: 'mount',
  target: { key, label: `${name} · ${branch}`, kind: 'session', sessionId: SESSION_ID, path },
  projectId: null,
  projectName: name,
  branch,
  path,
  folder: null,
});

const CLUSTERS: ReadonlyArray<PickerCluster> = [
  {
    key: 'workspace',
    sessionId: null,
    title: 'Workspace folder',
    rows: [
      {
        key: 'workspace',
        kind: 'workspace',
        target: { key: 'workspace', label: 'Workspace folder', kind: 'workspace', path: '/work' },
        projectId: null,
        projectName: 'harborline',
        branch: null,
        path: '/work',
        folder: null,
      },
    ],
  },
  {
    key: SESSION_ID,
    sessionId: null,
    title: 'Ledger export speed up',
    rows: [
      row({
        key: 'mount:1',
        name: 'payments-api',
        branch: 'mara/ledger-export',
        path: '/work/payments-api',
      }),
      row({
        key: 'mount:2',
        name: 'ledger-core',
        branch: 'mara/ledger-export',
        path: '/work/ledger-core',
      }),
    ],
  },
];

const openByKey = (): void => {
  act(() => {
    window.dispatchEvent(new CustomEvent(TERMINAL_PICKER_EVENTS.page));
  });
};

describe('the New terminal button', () => {
  it('carries the plus glyph, not the compose pencil, and opens a terminal', () => {
    const onNew = vi.fn();
    render(<NewTerminalMenu clusters={[]} onNew={onNew} onOpenAt={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'New terminal' });
    expect(button.querySelector('svg.lucide-plus')).not.toBeNull();
    expect(button.querySelector('svg.lucide-square-pen')).toBeNull();
    fireEvent.click(button);
    expect(onNew).toHaveBeenCalledOnce();
  });
});

describe('the New terminal in picker opened by key', () => {
  it('opens on the key event with the filter focused and Enter opens the first row', () => {
    const onOpenAt = vi.fn();
    render(<NewTerminalMenu clusters={CLUSTERS} onNew={vi.fn()} onOpenAt={onOpenAt} />);

    openByKey();
    const filter = screen.getByRole('searchbox', { name: 'Filter terminal locations' });
    expect(document.activeElement).toBe(filter);
    fireEvent.keyDown(filter, { key: 'Enter' });

    expect(onOpenAt).toHaveBeenCalledOnce();
    expect(onOpenAt.mock.calls[0]?.[0]).toMatchObject({ key: 'workspace' });
  });

  it('filters the rows as the query is typed and Enter opens the first match', () => {
    const onOpenAt = vi.fn();
    render(<NewTerminalMenu clusters={CLUSTERS} onNew={vi.fn()} onOpenAt={onOpenAt} />);

    openByKey();
    const filter = screen.getByRole('searchbox', { name: 'Filter terminal locations' });
    fireEvent.change(filter, { target: { value: 'ledger-core' } });
    expect(screen.queryByText('payments-api')).toBeNull();
    fireEvent.keyDown(filter, { key: 'Enter' });

    expect(onOpenAt.mock.calls[0]?.[0]).toMatchObject({ key: 'mount:2' });
  });

  it('moves focus into the rows with the arrow key and opens the focused row', () => {
    const onOpenAt = vi.fn();
    render(<NewTerminalMenu clusters={CLUSTERS} onNew={vi.fn()} onOpenAt={onOpenAt} />);

    openByKey();
    const filter = screen.getByRole('searchbox', { name: 'Filter terminal locations' });
    fireEvent.keyDown(filter, { key: 'ArrowDown' });
    const focused = document.activeElement;
    expect(focused?.getAttribute('role')).toBe('menuitem');
    if (focused !== null) {
      fireEvent.click(focused);
    }

    expect(onOpenAt).toHaveBeenCalledOnce();
  });

  it('closes on Escape without opening anything', () => {
    const onOpenAt = vi.fn();
    render(<NewTerminalMenu clusters={CLUSTERS} onNew={vi.fn()} onOpenAt={onOpenAt} />);

    openByKey();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('searchbox', { name: 'Filter terminal locations' })).toBeNull();
    expect(onOpenAt).not.toHaveBeenCalled();
  });
});
