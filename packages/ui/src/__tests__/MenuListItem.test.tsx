// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MenuList } from '../components/ContextMenu/MenuList';

afterEach(cleanup);

const SOLID_HOVER = /(^|\s)bg-hover(\s|$)/;

describe('a group in MenuList', () => {
  it('names its rows by the group label and moves across groups with the arrow keys', () => {
    const onPick = vi.fn();
    render(
      <MenuList
        label="New terminal in"
        entries={[
          {
            kind: 'group',
            key: 'workspace',
            label: 'Workspace folder',
            items: [{ kind: 'item', key: 'harborline', label: 'harborline', onSelect: vi.fn() }],
          },
          {
            kind: 'group',
            key: 'ledger',
            label: 'Ledger export',
            items: [{ kind: 'item', key: 'ledger-core', label: 'ledger-core', onSelect: onPick }],
          },
        ]}
        onClose={vi.fn()}
      />,
    );
    const ledger = screen.getByRole('group', { name: 'Ledger export' });

    expect(
      within(ledger)
        .getAllByRole('menuitem')
        .map((row) => row.textContent),
    ).toEqual(['ledger-core']);
    fireEvent.keyDown(screen.getByRole('menu', { name: 'New terminal in' }), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'ledger-core' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'ledger-core' }));
    expect(onPick).toHaveBeenCalledOnce();
  });
});

describe('an item in MenuList', () => {
  it('marks the active row and shows its tooltip on hover', async () => {
    render(
      <MenuList
        label="New terminal in"
        isAutoFocus={false}
        entries={[
          { kind: 'header', key: 'header', label: 'Ledger export' },
          {
            kind: 'item',
            key: 'payments',
            label: 'payments-api',
            description: 'mara/ledger-export',
            tooltip: '/work/payments-api',
            isActive: true,
            onSelect: vi.fn(),
          },
          { kind: 'item', key: 'ledger', label: 'ledger-core', onSelect: vi.fn() },
        ]}
        onClose={vi.fn()}
      />,
    );
    const active = screen.getByRole('menuitem', { name: /payments-api/ });

    expect(active.className).toMatch(SOLID_HOVER);
    expect(screen.getByRole('menuitem', { name: 'ledger-core' }).className).not.toMatch(
      SOLID_HOVER,
    );
    fireEvent.mouseEnter(active);
    expect((await screen.findByRole('tooltip')).textContent).toBe('/work/payments-api');
  });

  it('clamps a long description to three lines under a one-line title', () => {
    render(
      <MenuList
        label="Stopped rebases"
        isAutoFocus={false}
        entries={[
          {
            kind: 'item',
            key: 'stop',
            label: 'Rebase of hl/feat-ledger-postings stopped',
            description: 'Conflict in SideBarFooter.tsx, PastDue.tsx and 3 more',
            onSelect: vi.fn(),
          },
        ]}
        onClose={vi.fn()}
      />,
    );

    const row = screen.getByRole('menuitem', { name: /Rebase of hl/ });
    expect(row.querySelector('.truncate')?.textContent).toBe(
      'Rebase of hl/feat-ledger-postings stopped',
    );
    expect(
      screen.getByText('Conflict in SideBarFooter.tsx, PastDue.tsx and 3 more').className,
    ).toContain('line-clamp-3');
  });
});
