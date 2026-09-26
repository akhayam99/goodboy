// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { STRIPED_ROW } from '@goodboy/ui';
import { ModelTable } from './ModelTable';
import type { ModelBreakdownEntry } from './lib';

afterEach(cleanup);

const entry = (index: number): ModelBreakdownEntry => ({
  provider: 'anthropic',
  model: `model-${index}`,
  coverage: 'measured',
  turnCount: 1,
  uncountedTurns: 0,
  tokensIn: 100,
  tokensOut: 50,
  spentUsd: index,
});

const bodyRows = () => screen.getAllByRole('row').slice(1);

describe('ModelTable', () => {
  it('stripes the rows from five up, with no divider between them', () => {
    render(<ModelTable entries={[1, 2, 3, 4, 5].map(entry)} />);

    expect(bodyRows()).toHaveLength(5);
    for (const row of bodyRows()) {
      expect(row.className).toContain(STRIPED_ROW);
    }
    expect(screen.getAllByRole('rowgroup')[1]?.className ?? '').not.toContain('divide-y');
  });

  it('leaves a short table unstriped', () => {
    render(<ModelTable entries={[1, 2, 3].map(entry)} />);

    for (const row of bodyRows()) {
      expect(row.className).not.toContain(STRIPED_ROW);
    }
  });
});
