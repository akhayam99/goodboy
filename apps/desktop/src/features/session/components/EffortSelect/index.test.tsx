// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EffortSelect } from './index';

afterEach(cleanup);

describe('EffortSelect', () => {
  it('renders an N/A placeholder when the model has no effort levels', () => {
    render(
      <EffortSelect model="unknown-model" value="medium" onChange={vi.fn()} disabled={false} />,
    );
    expect(screen.getByText('N/A')).toBeDefined();
  });
});
