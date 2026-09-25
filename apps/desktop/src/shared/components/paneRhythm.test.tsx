// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PANE_RHYTHM } from '@goodboy/ui';
import { PaneShell } from './PaneShell';
import { FocusedPane } from './PaneShell/FocusedPane';
import { StudioDetailLayout } from './StudioDetail/StudioDetailLayout';

afterEach(cleanup);

type ClassParams = {
  readonly node: HTMLElement;
  readonly pattern: RegExp;
};

const nearestClasses = ({ node, pattern }: ClassParams) => {
  let current: HTMLElement | null = node;
  while (current != null) {
    const matched = current.className.split(' ').filter((entry) => pattern.test(entry));
    if (matched.length > 0) {
      return [...matched].sort().join(' ');
    }
    current = current.parentElement;
  }
  return '';
};

const GUTTER = /^px-/;
const WIDTH = /^max-w-/;

describe('pane rhythm', () => {
  it('gives every shell the same horizontal gutter', () => {
    render(
      <>
        <PaneShell title="Pane">
          <p>Pane body</p>
        </PaneShell>
        <PaneShell title="Framed" scroll="body">
          <p>Framed body</p>
        </PaneShell>
        <FocusedPane lens="Lens">
          <p>Focused body</p>
        </FocusedPane>
        <StudioDetailLayout header={<span>Detail header</span>}>
          <p>Detail body</p>
        </StudioDetailLayout>
      </>,
    );

    const gutters = [
      nearestClasses({ node: screen.getByText('Pane body'), pattern: GUTTER }),
      nearestClasses({ node: screen.getByText('Framed'), pattern: GUTTER }),
      nearestClasses({ node: screen.getByText('Framed body'), pattern: GUTTER }),
      nearestClasses({ node: screen.getByText('Lens'), pattern: GUTTER }),
      nearestClasses({ node: screen.getByText('Detail header'), pattern: GUTTER }),
      nearestClasses({ node: screen.getByText('Detail body'), pattern: GUTTER }),
    ];
    for (const gutter of gutters) {
      expect(gutter.split(' ')).toContain(PANE_RHYTHM.inset);
    }
  });

  it('lands the detail header, its tabs, its body, and its dock on the content column', () => {
    render(
      <StudioDetailLayout
        header={<span>Detail header</span>}
        tabs={<span>Detail tabs</span>}
        dock={<span>Detail dock</span>}
      >
        <p>Detail body</p>
      </StudioDetailLayout>,
    );

    for (const label of ['Detail header', 'Detail tabs', 'Detail body', 'Detail dock']) {
      expect(nearestClasses({ node: screen.getByText(label), pattern: WIDTH })).toBe(
        'max-w-[var(--column-max)]',
      );
    }
  });

  it('frames every pane shell region on the same page column', () => {
    render(
      <PaneShell title="Panel" scroll="body" dock={<span>Panel dock</span>}>
        <p>Panel body</p>
      </PaneShell>,
    );

    const widths = ['Panel', 'Panel body', 'Panel dock'].map((label) =>
      nearestClasses({ node: screen.getByText(label), pattern: WIDTH }),
    );
    expect(new Set(widths)).toEqual(new Set(['max-w-[var(--column-frame)]']));
    expect(nearestClasses({ node: screen.getByText('Panel body'), pattern: /^mx-auto$/ })).toBe(
      'mx-auto',
    );
  });
});
