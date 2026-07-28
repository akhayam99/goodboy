// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StudioRailLayout } from '.';

afterEach(cleanup);

describe('StudioRailLayout', () => {
  it('renders an accessible rail beside its detail region', () => {
    render(
      <StudioRailLayout
        rail={<p>Rail content</p>}
        detail={<p>Detail content</p>}
        railLabel="Project navigation"
        railWidth="standard"
      />,
    );

    expect(screen.getByRole('complementary', { name: 'Project navigation' })).toBeDefined();
    expect(screen.getByText('Rail content')).toBeDefined();
    expect(screen.getByText('Detail content')).toBeDefined();
    expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe('vertical');
  });
});
