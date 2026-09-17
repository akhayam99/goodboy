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

    if (wrapper == null) {
      throw new Error('wrapper not found');
    }

    expect(wrapper.classList.contains('flex')).toBe(true);
    expect(Array.from(wrapper.children).map((child) => child.tagName)).toEqual([
      'ASIDE',
      'DIV',
      'DIV',
    ]);

    const [asideChild, separatorChild, detailChild] = wrapper.children;

    if (asideChild == null || separatorChild == null || detailChild == null) {
      throw new Error('wrapper children not found');
    }

    expect(asideChild).toBe(aside);
    expect(separatorChild).toBe(screen.getByRole('separator'));
    expect(detailChild.textContent).toBe('Detail content');
  });

  it('lets the detail column shrink under its content instead of pushing the pane wide', () => {
    render(
      <StudioRailLayout
        rail={<p>Rail content</p>}
        detail={<p>Detail content</p>}
        railLabel="Project navigation"
        railWidth="standard"
      />,
    );

    const detail = screen.getByText('Detail content').parentElement;
    expect(detail?.className).toContain('min-w-0');
    expect(detail?.className).toContain('flex-1');
  });

  it('carries the container query classes that gate a wide rail, which happy-dom cannot evaluate', () => {
    render(
      <StudioRailLayout
        rail={<p>Rail content</p>}
        detail={<p>Detail content</p>}
        railLabel="Project navigation"
        railWidth="narrow"
        railVisibility="wideContainer"
      />,
    );

    const aside = screen.getByRole('complementary', { name: 'Project navigation' });
    expect(aside.parentElement?.className).toContain('@container');
    expect(aside.className).toContain('hidden');
    expect(aside.className).toContain('@min-[1025px]:flex');
    expect(screen.getByRole('separator').className).toContain('@min-[1025px]:block');
  });

  it('keeps the rail unconditional for the studios that do not opt in', () => {
    render(
      <StudioRailLayout
        rail={<p>Rail content</p>}
        detail={<p>Detail content</p>}
        railLabel="Project navigation"
        railWidth="standard"
      />,
    );

    const aside = screen.getByRole('complementary', { name: 'Project navigation' });
    expect(aside.className).toContain('flex');
    expect(aside.className).not.toContain('hidden');
    expect(aside.parentElement?.className).not.toContain('@container');
  });
});
