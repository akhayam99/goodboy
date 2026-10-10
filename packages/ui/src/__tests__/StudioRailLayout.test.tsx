// @vitest-environment happy-dom

import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STUDIO_RAIL_MAX,
  STUDIO_RAIL_MIN,
  STUDIO_RAIL_WIDTHS,
  StudioRailLayout,
  readStudioRailWidth,
  studioRailStorageKey,
} from '../components/StudioRailLayout';

const WIDTH_VAR = '--goodboy-studio-rail-width';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type LayoutProps = Partial<ComponentProps<typeof StudioRailLayout>>;

const renderLayout = (props: LayoutProps = {}) =>
  render(
    <StudioRailLayout
      rail={<p>Rail content</p>}
      detail={<p>Detail content</p>}
      railLabel="Project navigation"
      railWidth="standard"
      surface="guide"
      {...props}
    />,
  );

const railWidth = (): string =>
  screen
    .getByRole('complementary', { name: 'Project navigation' })
    .parentElement?.style.getPropertyValue(WIDTH_VAR) ?? '';

const handle = () => screen.getByRole('separator', { name: 'Resize project navigation' });

describe('StudioRailLayout', () => {
  it('renders an accessible rail beside its detail region', () => {
    renderLayout();

    expect(screen.getByRole('complementary', { name: 'Project navigation' })).toBeDefined();
    expect(screen.getByText('Rail content')).toBeDefined();
    expect(screen.getByText('Detail content')).toBeDefined();
    expect(handle().getAttribute('aria-valuenow')).toBe(String(STUDIO_RAIL_WIDTHS.standard));
  });

  it('wraps aside and detail sheet in a flex row so hosts cannot break the layout', () => {
    renderLayout();

    const aside = screen.getByRole('complementary', { name: 'Project navigation' });
    const wrapper = aside.parentElement;

    if (wrapper == null) {
      throw new Error('wrapper not found');
    }

    expect(wrapper.classList.contains('flex')).toBe(true);
    expect(Array.from(wrapper.children).map((child) => child.tagName)).toEqual(['ASIDE', 'DIV']);

    const [asideChild, detailChild] = wrapper.children;

    if (asideChild == null || detailChild == null) {
      throw new Error('wrapper children not found');
    }

    expect(asideChild).toBe(aside);
    expect((detailChild as HTMLElement).dataset.sheet).toBe('wrapped');
    expect(detailChild.textContent).toBe('Detail content');
  });

  it('lets the detail column shrink under its content instead of pushing the pane wide', () => {
    renderLayout();

    const detail = screen.getByText('Detail content').parentElement;
    expect(detail?.className).toContain('min-w-0');
    expect(detail?.className).toContain('flex-1');
  });

  it('reads a saved width back clamped, under a key of its own studio', () => {
    localStorage.setItem(studioRailStorageKey({ surface: 'guide' }), '9000');
    localStorage.setItem(studioRailStorageKey({ surface: 'chat' }), '300');

    renderLayout({ surface: 'guide' });

    expect(railWidth()).toBe(`${STUDIO_RAIL_MAX}px`);
    expect(readStudioRailWidth({ surface: 'chat', railWidth: 'narrow' })).toBe(300);
    expect(readStudioRailWidth({ surface: 'inbox', railWidth: 'narrow' })).toBe(
      STUDIO_RAIL_WIDTHS.narrow,
    );
  });

  it('steps with the arrow keys, stops at its bounds and saves each step', () => {
    renderLayout();

    fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    expect(localStorage.getItem(studioRailStorageKey({ surface: 'guide' }))).toBe('296');

    fireEvent.keyDown(handle(), { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyDown(handle(), { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyDown(handle(), { key: 'ArrowLeft', shiftKey: true });

    expect(railWidth()).toBe(`${STUDIO_RAIL_MIN}px`);
    expect(localStorage.getItem(studioRailStorageKey({ surface: 'guide' }))).toBe(
      String(STUDIO_RAIL_MIN),
    );
  });

  it('goes back to its default width on double click', () => {
    localStorage.setItem(studioRailStorageKey({ surface: 'guide' }), '400');
    renderLayout();

    fireEvent.doubleClick(handle());

    expect(railWidth()).toBe(`${STUDIO_RAIL_WIDTHS.standard}px`);
    expect(localStorage.getItem(studioRailStorageKey({ surface: 'guide' }))).toBe(
      String(STUDIO_RAIL_WIDTHS.standard),
    );
  });

  it('drags through a CSS variable: no write and no detail render until release', () => {
    let detailRenders = 0;
    const Detail = () => {
      detailRenders += 1;
      return <p>Detail content</p>;
    };
    renderLayout({ detail: <Detail /> });
    const setItem = vi.spyOn(localStorage, 'setItem');

    fireEvent.mouseDown(handle(), { button: 0, clientX: 300 });
    const rendersAtStart = detailRenders;
    Array.from({ length: 50 }).forEach((_, index) =>
      fireEvent.mouseMove(window, { clientX: 300 + index }),
    );

    expect(setItem).not.toHaveBeenCalled();
    expect(detailRenders).toBe(rendersAtStart);
    expect(railWidth()).toBe(`${STUDIO_RAIL_WIDTHS.standard + 49}px`);

    fireEvent.mouseUp(window);

    expect(setItem).toHaveBeenCalledOnce();
    expect(setItem).toHaveBeenCalledWith(
      studioRailStorageKey({ surface: 'guide' }),
      String(STUDIO_RAIL_WIDTHS.standard + 49),
    );
  });

  it('draws no fold control and no header row unless the page asks for one', () => {
    renderLayout();

    const rail = screen.getByRole('complementary', { name: 'Project navigation' });

    expect(screen.queryByRole('button', { name: 'Fold the rail' })).toBeNull();
    expect(rail.firstElementChild?.textContent).toBe('Rail content');
  });

  it('clamps a saved width to the min and max a page passes', () => {
    localStorage.setItem(studioRailStorageKey({ surface: 'guide' }), '9000');
    const first = renderLayout({ min: 240, max: 360 });

    expect(railWidth()).toBe('360px');

    first.unmount();
    localStorage.setItem(studioRailStorageKey({ surface: 'guide' }), '10');
    renderLayout({ min: 240, max: 360 });

    expect(railWidth()).toBe('240px');
    expect(handle().getAttribute('aria-valuemin')).toBe('240');
    expect(handle().getAttribute('aria-valuemax')).toBe('360');
    expect(
      readStudioRailWidth({ surface: 'guide', railWidth: 'standard', min: 240, max: 360 }),
    ).toBe(240);
  });

  it('hides the rail and its handle while collapsed and keeps the detail', () => {
    renderLayout({ isCollapsed: true, onCollapsedChange: vi.fn() });

    expect(screen.queryByRole('complementary', { name: 'Project navigation' })).toBeNull();
    expect(screen.queryByRole('separator', { name: 'Resize project navigation' })).toBeNull();
    expect(screen.getByText('Detail content')).toBeDefined();
  });

  it('puts the header and a fold control in the first row and reports the fold', () => {
    const onCollapsedChange = vi.fn();
    renderLayout({ railHeader: <p>Header content</p>, onCollapsedChange });

    const rail = screen.getByRole('complementary', { name: 'Project navigation' });
    const row = rail.firstElementChild;

    expect(row?.textContent).toContain('Header content');
    expect(row?.contains(screen.getByRole('button', { name: 'Fold the rail' }))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Fold the rail' }));

    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });
});
