// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PANE_RHYTHM } from '../paneRhythm';
import { FocusedPane } from './FocusedPane';
import { PaneShell } from '.';

afterEach(cleanup);

const closestWith = ({
  node,
  pattern,
}: {
  readonly node: HTMLElement;
  readonly pattern: RegExp;
}) => {
  let current: HTMLElement | null = node;
  while (current != null) {
    if (current.className.split(' ').some((entry) => pattern.test(entry))) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

describe('PaneShell', () => {
  it('renders the title, meta, description, actions, and children', () => {
    render(
      <PaneShell
        title="Linear"
        description="External Linear issues linked to this session."
        meta={3}
        actions={<button type="button">Link issue</button>}
      >
        <p>Body copy</p>
      </PaneShell>,
    );

    expect(screen.getByRole('heading', { name: 'Linear' })).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('External Linear issues linked to this session.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Link issue' })).toBeDefined();
    expect(screen.getByText('Body copy')).toBeDefined();
  });

  it('insets the pane body on the shared rhythm and holds the reading measure left aligned', () => {
    render(
      <PaneShell title="Linear" measure="reading">
        <p>Body copy</p>
      </PaneShell>,
    );

    const column = closestWith({
      node: screen.getByText('Body copy'),
      pattern: /^max-w-/,
    }) as HTMLElement;
    expect(column.className).toContain(PANE_RHYTHM.measure.reading);
    expect(column.className).not.toContain('mx-auto');

    const viewport = closestWith({ node: column, pattern: /^p[xy]-/ }) as HTMLElement;
    expect(viewport.className).toContain(PANE_RHYTHM.body);
  });

  it('widens to every measure the rhythm defines', () => {
    render(
      <PaneShell title="File versions" measure="full">
        <p>Body copy</p>
      </PaneShell>,
    );

    const column = closestWith({
      node: screen.getByText('Body copy'),
      pattern: /^max-w-/,
    }) as HTMLElement;
    expect(column.className).toContain(PANE_RHYTHM.measure.full);
  });
});

describe('FocusedPane', () => {
  it('renders the lens, the count, the actions, and the body', () => {
    render(
      <FocusedPane lens="Workflows" count={2} actions={<button type="button">Close</button>}>
        <p>Body copy</p>
      </FocusedPane>,
    );

    expect(screen.getByRole('heading', { name: 'Workflows' })).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDefined();
    expect(screen.getByText('Body copy')).toBeDefined();
  });

  it('insets its header on the shared rhythm', () => {
    render(
      <FocusedPane lens="Workflows">
        <p>Body copy</p>
      </FocusedPane>,
    );

    const header = closestWith({
      node: screen.getByRole('heading', { name: 'Workflows' }),
      pattern: /^p[xy]-/,
    }) as HTMLElement;
    expect(header.className).toContain(PANE_RHYTHM.header);
  });
});
