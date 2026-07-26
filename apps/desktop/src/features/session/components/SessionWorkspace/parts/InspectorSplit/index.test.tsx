// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InspectorSplit } from './index';

afterEach(cleanup);

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

  it('shows the panel at the standard width when open', () => {
    const { container } = render(
      <InspectorSplit open panel={<div>Inspector content</div>}>
        <div>Main content</div>
      </InspectorSplit>,
    );

    expect(screen.getByText('Inspector content')).toBeDefined();
    expect(container.querySelector('.w-80')).not.toBeNull();
  });
});
