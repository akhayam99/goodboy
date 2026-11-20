// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { TrendStatCard } from './index';

afterEach(cleanup);

describe('TrendStatCard', () => {
  it('says not loaded and shows no trend when the value is unknown', () => {
    const { container } = render(
      <TrendStatCard label="Merged pull requests" value="-" current={null} previous={3} />,
    );

    expect(container.textContent).toContain('not loaded');
    expect(container.textContent).not.toContain('vs prior');
  });

  it('keeps a loaded zero as a number with its trend', () => {
    const { container } = render(
      <TrendStatCard label="Merged pull requests" value="0" current={0} previous={2} />,
    );

    expect(container.textContent).toContain('-2 vs prior');
    expect(container.textContent).not.toContain('not loaded');
  });

  it('calls a loaded figure with no prior window all-time', () => {
    const { container } = render(
      <TrendStatCard label="Median resolve" value="n/a" current={0} previous={null} />,
    );

    expect(container.textContent).toContain('all-time');
  });
});
