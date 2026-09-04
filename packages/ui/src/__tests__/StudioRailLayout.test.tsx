// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StudioRailLayout } from '../components/StudioRailLayout';

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

  it('wraps aside, divider and detail in a flex row so hosts cannot break the layout', () => {
    render(
      <StudioRailLayout
        rail={<p>Rail content</p>}
        detail={<p>Detail content</p>}
        railLabel="Project navigation"
        railWidth="standard"
      />,
    );

    const aside = screen.getByRole('complementary', { name: 'Project navigation' });
    const wrapper = aside.parentElement;

    expect(wrapper).not.toBeNull();
    expect(wrapper?.classList.contains('flex')).toBe(true);
    expect(Array.from(wrapper?.children ?? []).map((child) => child.tagName)).toEqual([
      'ASIDE',
      'DIV',
      'DIV',
    ]);
    expect(wrapper?.children[0]).toBe(aside);
    expect(wrapper?.children[1]).toBe(screen.getByRole('separator'));
    expect(wrapper?.children[2].textContent).toBe('Detail content');
  });
});
