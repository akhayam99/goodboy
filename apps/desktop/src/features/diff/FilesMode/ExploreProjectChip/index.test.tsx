// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { CrumbMenuGroup, CrumbMenuRow } from '@goodboy/ui';
import { ToastProvider } from '../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import type { ExploreTarget } from '../../../explore/selectExploreMount';
import { ExploreProjectChip } from '.';

afterEach(cleanup);

const LEDGER = {
  kind: 'mount',
  projectName: 'ledger-core',
  branch: 'hl/ledger-rounding',
  path: '/work/ledger-core',
} satisfies ExploreTarget;

type GroupsParams = {
  readonly onPick: () => void;
};

type RowParams = {
  readonly id: string;
  readonly label: string;
  readonly isCurrent: boolean;
  readonly onSelect: () => void;
};

const rowOf = ({ id, label, isCurrent, onSelect }: RowParams): CrumbMenuRow => ({
  id,
  lead: { kind: 'node', node: null },
  label,
  secondary: null,
  metaA: null,
  state: null,
  isCurrent,
  isDisabled: false,
  indent: 0,
  onSelect,
});

const groupsOf = ({ onPick }: GroupsParams): ReadonlyArray<CrumbMenuGroup> => [
  {
    id: 'ledger-core',
    label: 'ledger-core',
    rows: [rowOf({ id: 'a', label: 'hl/ledger-rounding', isCurrent: true, onSelect: vi.fn() })],
  },
  {
    id: 'notify-relay',
    label: 'notify-relay',
    rows: [rowOf({ id: 'b', label: 'hl/notify-retry', isCurrent: false, onSelect: onPick })],
  },
];

type MountParams = {
  readonly target: ExploreTarget;
  readonly rowCount: number;
  readonly onPick: () => void;
};

const mountChip = ({ target, rowCount, onPick }: MountParams) =>
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <ExploreProjectChip target={target} groups={groupsOf({ onPick })} rowCount={rowCount} />
      </ObjectMenuProvider>
    </ToastProvider>,
  );

describe('the project chip of the Changes page', () => {
  it('names the project and the branch as plain text with one project', () => {
    mountChip({ target: LEDGER, rowCount: 1, onPick: vi.fn() });

    expect(screen.getByTestId('explore-project').textContent).toContain('ledger-core');
    expect(screen.getByTestId('explore-project').textContent).toContain('hl/ledger-rounding');
    expect(screen.queryByRole('button', { name: /^Folder / })).toBeNull();
  });

  it('reads a folder project by its name alone', () => {
    mountChip({ target: { ...LEDGER, branch: '' }, rowCount: 1, onPick: vi.fn() });

    expect(screen.getByTestId('explore-project').textContent).toBe('ledger-core');
  });

  it('opens a menu grouped by project with a check on the one shown, and picks one', async () => {
    const onPick = vi.fn();
    mountChip({ target: LEDGER, rowCount: 2, onPick });

    fireEvent.click(screen.getByRole('button', { name: 'Folder ledger-core, hl/ledger-rounding' }));

    const menu = await screen.findByRole('menu', { name: 'Projects' });
    within(menu).getByRole('group', { name: 'ledger-core' });
    within(menu).getByRole('group', { name: 'notify-relay' });
    const rows = within(menu).getAllByRole('menuitemradio');
    expect(rows.map((row) => row.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    const [, second] = rows;
    if (second === undefined) {
      throw new Error('the menu lists two rows');
    }
    fireEvent.click(second);
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});
