// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../../store';
import { SearchIndexBand } from './SearchIndexBand';

const rebuildSearchIndex = vi.fn(async () => undefined);
const setProjectSearchExcluded = vi.fn(async () => undefined);
const loadSearchIndexStatus = vi.fn(async () => undefined);

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({
    projects: [
      { id: 'p-ledger', name: 'ledger-core', disconnectedAt: null },
      { id: 'p-relay', name: 'notify-relay', disconnectedAt: null },
    ],
    searchIndexStatus: {
      docs: 12_481,
      bytes: 3_355_443,
      scanned: 40,
      total: 100,
      isBackfillDone: false,
      excludedProjectIds: ['p-relay'],
    },
    isSearchIndexRebuilding: false,
    loadSearchIndexStatus,
    rebuildSearchIndex,
    setProjectSearchExcluded,
  } as never);
});

afterEach(cleanup);

describe('search index settings', () => {
  it('shows the size, the item count and the backfill progress', () => {
    render(<SearchIndexBand />);
    expect(screen.getByText(/for 12,481 items/)).toBeTruthy();
    expect(screen.getByText('Indexing older sessions · 40%')).toBeTruthy();
    expect(loadSearchIndexStatus).toHaveBeenCalled();
  });

  it('rebuilds on request', async () => {
    render(<SearchIndexBand />);
    await userEvent.click(screen.getByRole('button', { name: 'Rebuild' }));
    expect(rebuildSearchIndex).toHaveBeenCalledTimes(1);
  });

  it('leaves a project out and brings one back', async () => {
    render(<SearchIndexBand />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Projects search leaves out' }));
    await userEvent.click(screen.getByRole('option', { name: /ledger-core/ }));
    expect(setProjectSearchExcluded).toHaveBeenCalledWith({
      projectId: 'p-ledger',
      isExcluded: true,
    });
    await userEvent.click(screen.getByRole('option', { name: /notify-relay/ }));
    expect(setProjectSearchExcluded).toHaveBeenCalledWith({
      projectId: 'p-relay',
      isExcluded: false,
    });
  });
});
