// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StepRowCompact } from './index';

afterEach(cleanup);

describe('StepRowCompact', () => {
  it('renders the ordinal, name and model meta', () => {
    render(
      <StepRowCompact
        index={2}
        kind="implementer"
        name="build it"
        model="gpt-5"
        verbosity="brief"
      />,
    );
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('build it')).toBeDefined();
    expect(screen.getByText(/brief/)).toBeDefined();
  });
});
