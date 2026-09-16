// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { parseWireframeSource, type WireframeDocument } from '@goodboy/core';
import { CONTACT_SHEET_PLATE_WIDTH, wireframePalette } from '../../wireframePalette';
import { WireframeContactSheet } from './index';

const source = {
  version: 1,
  initialScreenId: 'sign-in',
  theme: { name: 'harborline', font: 'sans', radius: 'md' },
  screens: [
    {
      id: 'sign-in',
      title: 'Sign in',
      viewport: 'mobile',
      root: {
        id: 'sign-in-root',
        kind: 'stack',
        direction: 'column',
        children: [
          { id: 'sign-in-heading', kind: 'text', text: 'Harborline', variant: 'title' },
          { id: 'sign-in-email', kind: 'input', inputType: 'email', label: 'Work email' },
          {
            id: 'sign-in-continue',
            kind: 'button',
            label: 'Continue',
            variant: 'primary',
            action: { type: 'navigate', toScreenId: 'ledger' },
          },
        ],
      },
    },
    {
      id: 'ledger',
      title: 'Ledger',
      viewport: 'mobile',
      note: 'the empty state is drawn on the next screen',
      root: {
        id: 'ledger-root',
        kind: 'stack',
        direction: 'column',
        children: [
          {
            id: 'ledger-list',
            kind: 'list',
            items: [
              { id: 'ledger-row-1', title: 'Northwind', subtitle: 'settled' },
              { id: 'ledger-row-2', title: 'Acme', subtitle: 'pending' },
            ],
          },
        ],
      },
    },
    {
      id: 'relay',
      title: 'Relay settings',
      viewport: 'tablet',
      root: {
        id: 'relay-root',
        kind: 'stack',
        direction: 'column',
        children: [{ id: 'relay-hold', kind: 'input', inputType: 'checkbox', label: 'Hold' }],
      },
    },
    {
      id: 'console',
      title: 'Console',
      viewport: 'desktop',
      root: {
        id: 'console-root',
        kind: 'stack',
        direction: 'column',
        children: [
          {
            id: 'console-nav',
            kind: 'navigation',
            variant: 'top',
            items: [{ id: 'console-nav-ledger', label: 'Ledger', isActive: true }],
          },
        ],
      },
    },
  ],
  transitions: [{ fromNodeId: 'sign-in-continue', toScreenId: 'ledger', label: 'continue' }],
};

const parse = ({
  overrides,
}: {
  readonly overrides: Record<string, unknown>;
}): WireframeDocument => {
  const parsed = parseWireframeSource({ source: JSON.stringify({ ...source, ...overrides }) });
  if (parsed.status === 'invalid') {
    throw new Error(`the fixture does not parse: ${JSON.stringify(parsed.issues)}`);
  }
  return parsed.document;
};

const renderSheet = ({ overrides = {} }: { readonly overrides?: Record<string, unknown> } = {}) => {
  const document = parse({ overrides });
  return render(
    <WireframeContactSheet
      document={document}
      palette={wireframePalette({ theme: document.theme, fidelity: 'low' })}
      isLowFidelity
    />,
  );
};

afterEach(cleanup);

describe('WireframeContactSheet', () => {
  it('lays every screen out once, in document order', () => {
    renderSheet();
    const frames = screen.getAllByTestId('wireframe-sheet-frame');
    expect(frames.map((frame) => frame.getAttribute('data-screen-id'))).toEqual([
      'sign-in',
      'ledger',
      'relay',
      'console',
    ]);
  });

  it('labels each frame with its position and its title', () => {
    renderSheet();
    const items = screen.getAllByTestId('wireframe-sheet-item');
    expect(items[0]?.textContent).toContain('1');
    expect(items[0]?.textContent).toContain('Sign in');
    expect(items[3]?.textContent).toContain('4');
    expect(items[3]?.textContent).toContain('Console');
  });

  it('sizes each frame from the viewport of its own screen', () => {
    renderSheet();
    const frames = screen.getAllByTestId('wireframe-sheet-frame');
    expect(frames.map((frame) => frame.getAttribute('data-viewport'))).toEqual([
      'mobile',
      'mobile',
      'tablet',
      'desktop',
    ]);
    expect(frames[0]?.style.width).toBe(`${CONTACT_SHEET_PLATE_WIDTH.mobile}px`);
    expect(frames[2]?.style.width).toBe(`${CONTACT_SHEET_PLATE_WIDTH.tablet}px`);
    expect(frames[3]?.style.width).toBe(`${CONTACT_SHEET_PLATE_WIDTH.desktop}px`);
  });

  it('gives a mobile screen a home indicator and leaves a desktop screen without one', () => {
    renderSheet();
    expect(screen.getAllByTestId('wireframe-home-indicator')).toHaveLength(2);
    const chrome = screen.getAllByTestId('wireframe-frame-chrome');
    expect(chrome.map((bar) => bar.getAttribute('data-chrome'))).toEqual([
      'device',
      'device',
      'device',
      'window',
    ]);
  });

  it('draws the screen contents without hotspots or a selection', () => {
    renderSheet();
    const button = screen.getByText('Continue');
    expect(button.getAttribute('data-hotspot')).toBe('false');
    expect(button.getAttribute('style')).not.toContain('outline');
  });

  it('carries the note a screen writes for the reader', () => {
    renderSheet();
    expect(screen.getByText('the empty state is drawn on the next screen')).toBeDefined();
  });

  it('reads as a sheet when the document holds a single screen', () => {
    renderSheet({
      overrides: { initialScreenId: 'relay', screens: [source.screens[2]], transitions: [] },
    });
    expect(screen.getByTestId('wireframe-contact-sheet')).toBeDefined();
    expect(screen.getAllByTestId('wireframe-sheet-frame')).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
