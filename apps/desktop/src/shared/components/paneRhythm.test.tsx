// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PANE_RHYTHM } from '@goodboy/ui';
import { PaneShell } from './PaneShell';

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
        <PaneShell header={<span>Detail header</span>} scroll="self">
          <p>Detail body</p>
        </PaneShell>
      </>,
    );

    const gutters = [
      nearestClasses({ node: screen.getByText('Pane body'), pattern: GUTTER }),
      nearestClasses({ node: screen.getByText('Framed'), pattern: GUTTER }),
      nearestClasses({ node: screen.getByText('Framed body'), pattern: GUTTER }),
      nearestClasses({ node: screen.getByText('Detail header'), pattern: GUTTER }),
    ];
    for (const gutter of gutters) {
      expect(gutter.split(' ')).toContain(PANE_RHYTHM.inset);
    }
  });

  it('lands a custom header, its tabs, its body, and its dock on the page column', () => {
    render(
      <PaneShell
        header={<span>Detail header</span>}
        tabs={<span>Detail tabs</span>}
        dock={<span>Detail dock</span>}
        scroll="body"
      >
        <p>Detail body</p>
      </PaneShell>,
    );

    for (const label of ['Detail header', 'Detail tabs', 'Detail body', 'Detail dock']) {
      expect(nearestClasses({ node: screen.getByText(label), pattern: WIDTH })).toBe(
        'max-w-[var(--column-frame)]',
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
