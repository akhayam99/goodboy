// @vitest-environment happy-dom

import { Inbox } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  afterEach(cleanup);

  it('keeps the title and the helper in separate elements in a section', () => {
    render(
      <EmptyState
        size="section"
        headingLevel={3}
        icon={Inbox}
        title="No saved steps yet"
        description="Save a step from any workflow."
      />,
    );

    const title = screen.getByRole('heading', { name: 'No saved steps yet' });
    const helper = screen.getByText('Save a step from any workflow.');
    expect(helper).not.toBe(title);
    expect(title.contains(helper)).toBe(false);
    expect(helper.tagName).toBe('P');
  });
});
