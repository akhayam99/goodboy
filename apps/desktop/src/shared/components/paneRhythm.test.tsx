// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PANE_RHYTHM } from './paneRhythm';
import { PaneShell } from './PaneShell';
import { FocusedPane } from './PaneShell/FocusedPane';
import { StudioPanel } from './StudioPanel';
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

const INSET = /^p[xy]-/;
const MEASURE = /^max-w-/;

const paneShellBody = () => {
  const { unmount } = render(
    <PaneShell title="Pane" measure="reading">
      <p>Pane body</p>
    </PaneShell>,
  );
  const inset = nearestClasses({ node: screen.getByText('Pane body'), pattern: INSET });
  const measure = nearestClasses({ node: screen.getByText('Pane body'), pattern: MEASURE });
  unmount();
  return { inset, measure };
};

const focusedPaneHeader = () => {
  const { unmount } = render(
    <FocusedPane lens="Lens">
      <p>Focused body</p>
    </FocusedPane>,
  );
  const inset = nearestClasses({
    node: screen.getByRole('heading', { name: 'Lens' }),
    pattern: INSET,
  });
  unmount();
  return inset;
};

const studioDetail = () => {
  const { unmount } = render(
    <StudioDetailLayout header={<span>Detail header</span>} tabs={<span>Detail tabs</span>}>
      <p>Detail body</p>
    </StudioDetailLayout>,
  );
  const header = {
    inset: nearestClasses({ node: screen.getByText('Detail header'), pattern: INSET }),
    measure: nearestClasses({ node: screen.getByText('Detail header'), pattern: MEASURE }),
  };
  const tabsMeasure = nearestClasses({ node: screen.getByText('Detail tabs'), pattern: MEASURE });
  const body = {
    inset: nearestClasses({ node: screen.getByText('Detail body'), pattern: INSET }),
    measure: nearestClasses({ node: screen.getByText('Detail body'), pattern: MEASURE }),
  };
  unmount();
  return { header, tabsMeasure, body };
};

const studioPanel = () => {
  const { unmount } = render(
    <StudioPanel title="Panel">
      <p>Panel body</p>
    </StudioPanel>,
  );
  const header = nearestClasses({ node: screen.getByText('Panel'), pattern: INSET });
  const body = nearestClasses({ node: screen.getByText('Panel body'), pattern: INSET });
  unmount();
  return { header, body };
};

describe('pane rhythm', () => {
  it('gives every shell header the same inset', () => {
    const detail = studioDetail();
    const panel = studioPanel();

    expect(focusedPaneHeader()).toBe(detail.header.inset);
    expect(panel.header).toBe(detail.header.inset);
    expect(detail.header.inset).not.toBe('');
  });

  it('gives every shell body the same inset', () => {
    const detail = studioDetail();
    const panel = studioPanel();

    expect(paneShellBody().inset).toBe(detail.body.inset);
    expect(panel.body).toBe(detail.body.inset);
    expect(detail.body.inset).not.toBe('');
  });

  it('lands the detail header, its tabs, and its body on the same column', () => {
    const detail = studioDetail();

    expect(detail.header.measure).toBe(detail.body.measure);
    expect(detail.tabsMeasure).toBe(detail.body.measure);
    expect(detail.header.measure).toBe(PANE_RHYTHM.measure.reading);
  });

  it('holds one reading measure across the pane shell and the detail shell', () => {
    const detail = studioDetail();

    expect(paneShellBody().measure).toBe(detail.body.measure);
  });
});
