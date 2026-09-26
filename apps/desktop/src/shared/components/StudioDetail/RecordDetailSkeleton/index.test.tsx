// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RecordDetailSkeleton } from './index';

afterEach(cleanup);

describe('RecordDetailSkeleton', () => {
  it('shows the real identifier and title while the rest is still loading', () => {
    render(
      <RecordDetailSkeleton
        provider="linear"
        identifier="ACME-7"
        title="Fix the thing"
        loadingLabel="Loading Linear issue"
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Fix the thing' })).toBeDefined();
    expect(screen.getByText('ACME-7')).toBeDefined();
    expect(screen.getByRole('status', { name: 'Loading Linear issue' })).toBeDefined();
  });
});
