// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InspectorSplit } from './index';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('InspectorSplit', () => {
  it('keeps the main content visible while the panel is closed', () => {
    render(
      <InspectorSplit open={false} panel={<div>Inspector content</div>}>
        <div>Main content</div>
      </InspectorSplit>,
    );

    expect(screen.getByText('Main content')).toBeDefined();
    expect(screen.queryByText('Inspector content')).toBeNull();
  });

  it('shows a resizable panel at the standard width when open', () => {
    render(
      <InspectorSplit open panel={<div>Inspector content</div>}>
        <div>Main content</div>
      </InspectorSplit>,
    );

    expect(screen.getByText('Inspector content').parentElement?.style.width).toBe('320px');
    expect(screen.getByRole('separator', { name: 'resize inspector panel' })).toBeDefined();
  });
});
