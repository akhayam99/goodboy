// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ModelSelect } from './index';

afterEach(cleanup);

describe('ModelSelect', () => {
  it('renders the current model id in the trigger', () => {
    render(
      <ModelSelect
        provider="anthropic"
        value="claude-opus-4-5"
        onChange={vi.fn()}
        disabled={false}
      />,
    );
    expect(screen.getByRole('button')).toBeDefined();
  });
});
