// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InlineField } from './index';

afterEach(cleanup);

describe('InlineField', () => {
  it('renders the label and children', () => {
    render(
      <InlineField label="Model">
        <span>child</span>
      </InlineField>,
    );
    expect(screen.getByText('Model')).toBeDefined();
    expect(screen.getByText('child')).toBeDefined();
  });
});
