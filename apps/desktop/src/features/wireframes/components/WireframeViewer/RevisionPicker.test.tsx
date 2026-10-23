// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WireframeVersion } from '../../wireframeVersion';
import { RevisionPicker } from './RevisionPicker';

afterEach(cleanup);

type VersionParams = {
  readonly revision: number;
  readonly ask: string | null;
};

const version = ({ revision, ask }: VersionParams): WireframeVersion => ({
  revision,
  title: 'Ledger export',
  sourceText: '{}',
  author: 'agent',
  ask,
  createdAt: '2026-10-22T09:00:00.000Z',
  summary: null,
});

const VERSIONS = [
  version({ revision: 1, ask: null }),
  version({ revision: 2, ask: 'Move the totals up' }),
];

describe('RevisionPicker', () => {
  it('checks the shown version, moves with the arrow keys and picks another', () => {
    const onChange = vi.fn();
    render(<RevisionPicker label="Version" versions={VERSIONS} value={2} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Version: v2' }));
    const menu = screen.getByRole('menu', { name: 'Version' });
    expect(
      screen
        .getByRole('menuitemradio', { name: 'v2 Move the totals up' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(document.activeElement?.textContent).toBe('v1 First draft');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toBe('v2 Move the totals up');

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'v1 First draft' }));

    expect(onChange).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('menu', { name: 'Version' })).toBeNull();
  });
});
