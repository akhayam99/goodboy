// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ProjectId } from '@goodboy/types';
import { brandedId } from '../../../history/testing/brandedId';
import type { LaunchMount } from '../../../inbox/launchMountFor';
import { LaunchMountRow } from './LaunchMountRow';

const PAYMENTS = brandedId<ProjectId>({ value: 'project-payments-api' });
const LEDGER = brandedId<ProjectId>({ value: 'project-ledger-core' });

const ONE: LaunchMount = {
  options: [{ projectId: PAYMENTS, name: 'payments-api' }],
  selectedId: PAYMENTS,
  reason: 'from GitHub repo harborline/payments-api',
};

const TWO: LaunchMount = {
  options: [
    { projectId: PAYMENTS, name: 'payments-api' },
    { projectId: LEDGER, name: 'ledger-core' },
  ],
  selectedId: PAYMENTS,
  reason: 'from Sentry project payments-api',
};

afterEach(cleanup);

describe('LaunchMountRow', () => {
  it('draws the project chip with its reason by default, as the launch panel always did', () => {
    const { container } = render(
      <LaunchMountRow mount={ONE} selectedId={PAYMENTS} disabled={false} onChange={vi.fn()} />,
    );

    const chip = screen.getByRole('combobox', { name: 'Folder to work in' });
    expect(chip.textContent).toContain('Works in payments-api');
    expect(screen.getByText('from GitHub repo harborline/payments-api')).toBeDefined();
    const row = container.firstElementChild;
    expect(row?.tagName).toBe('DIV');
    expect(Array.from(row?.children ?? []).map((child) => child.tagName)).toEqual(['DIV', 'SPAN']);
    expect(container.querySelectorAll('[role="combobox"]')).toHaveLength(1);
  });

  it('keeps the chip for the default variant with several projects, and with none picked', () => {
    const { rerender } = render(
      <LaunchMountRow mount={TWO} selectedId={LEDGER} disabled={false} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('combobox', { name: 'Folder to work in' }).textContent).toContain(
      'Works in ledger-core',
    );

    rerender(<LaunchMountRow mount={ONE} selectedId={null} disabled={false} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Folder to work in' }).textContent).toContain(
      'No folder',
    );
  });

  it('draws one plain sentence with no chip in the line variant when the project is unambiguous', () => {
    render(
      <LaunchMountRow
        mount={ONE}
        selectedId={PAYMENTS}
        disabled={false}
        variant="line"
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText('In payments-api, from GitHub repo harborline/payments-api.'),
    ).toBeDefined();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('falls back to the chip in the line variant when there is a choice to make', () => {
    render(
      <LaunchMountRow
        mount={TWO}
        selectedId={PAYMENTS}
        disabled={false}
        variant="line"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Folder to work in' })).toBeDefined();
  });
});
