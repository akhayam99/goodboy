// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { UnderHeadContext } from '../../underHeadContext';
import { PageTrailContext } from './pageTrailContext';
import { PaneShell } from '.';

afterEach(() => {
  cleanup();
});

const classesOf = (node: Element | null): string[] => (node?.className ?? '').split(' ');

type PaneParams = {
  readonly isUnderHead: boolean;
};

const renderPane = ({ isUnderHead }: PaneParams) =>
  render(
    <UnderHeadContext.Provider value={isUnderHead}>
      <PageTrailContext.Provider value={<span>Overview</span>}>
        <PaneShell title="Retried webhooks no longer double credit">
          <PaneShell title="Ledger notes">
            <p>Body copy</p>
          </PaneShell>
        </PaneShell>
      </PageTrailContext.Provider>
    </UnderHeadContext.Provider>,
  );

const regionsOf = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>('[data-slot="reveal-region"]'),
];

const overlayOf = (region: HTMLElement | undefined) =>
  region?.querySelector<HTMLElement>(':scope > [data-slot="reveal-overlay"]') ?? null;

const PULL = ['relative', '-top-[var(--head-inset,0px)]', 'h-[calc(100%+var(--head-inset,0px))]'];

describe('a page under the session head', () => {
  it('reaches up under the head by its height so content scrolls under every head row', () => {
    const { container } = renderPane({ isUnderHead: true });
    const [outer] = regionsOf(container);
    const root = outer?.parentElement ?? null;

    expect(root?.hasAttribute('data-under-head')).toBe(true);
    expect(classesOf(root)).toEqual(expect.arrayContaining(PULL));
    expect(classesOf(root)).not.toContain('h-full');
  });

  it('draws one frost behind the head and its pinned rows, and the pinned row adds none', () => {
    const { container } = renderPane({ isUnderHead: true });
    const [outer] = regionsOf(container);
    const overlay = overlayOf(outer);
    const pinned = overlay?.querySelector('[data-slot="reveal-pinned"]') ?? null;

    expect(classesOf(overlay)).toEqual(
      expect.arrayContaining(['sticky-surface-head', 'pt-[var(--head-inset,0px)]']),
    );
    expect(classesOf(pinned)).not.toContain('sticky-surface');
    expect(overlay?.querySelectorAll('[class*="sticky-surface"]')).toHaveLength(0);
  });

  it('gives the head to the outer page only: a page nested in its body keeps its own frost', () => {
    const { container } = renderPane({ isUnderHead: true });
    const [, inner] = regionsOf(container);
    const innerHeader = inner?.querySelector(':scope > [data-slot="reveal-header"]') ?? null;

    expect(inner?.parentElement?.hasAttribute('data-under-head')).toBe(false);
    expect(classesOf(inner?.parentElement ?? null)).not.toContain('-top-[var(--head-inset,0px)]');
    expect(overlayOf(inner)?.className ?? '').not.toContain('sticky-surface-head');
    expect(classesOf(innerHeader)).toContain('sticky-surface');
  });

  it('leaves a page with no head above it as it was', () => {
    const { container } = renderPane({ isUnderHead: false });
    const [outer] = regionsOf(container);
    const overlay = overlayOf(outer);

    expect(outer?.parentElement?.hasAttribute('data-under-head')).toBe(false);
    expect(classesOf(outer?.parentElement ?? null)).toContain('h-full');
    expect(classesOf(overlay)).not.toContain('sticky-surface-head');
    expect(classesOf(overlay?.querySelector('[data-slot="reveal-pinned"]') ?? null)).toContain(
      'sticky-surface',
    );
  });
});
