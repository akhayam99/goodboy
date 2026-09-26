// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { recordByline, relativeTimeNode } from './recordByline';

describe('relativeTimeNode', () => {
  it('renders nothing for a missing or invalid date', () => {
    expect(relativeTimeNode({ iso: null })).toBeNull();
    expect(relativeTimeNode({ iso: '' })).toBeNull();
    expect(relativeTimeNode({ iso: 'not-a-date' })).toBeNull();
  });

  it('renders a time element with the relative age and the absolute date as a title', () => {
    const iso = new Date(Date.now() - 60_000).toISOString();
    const { container } = render(<>{relativeTimeNode({ iso })}</>);
    const time = container.querySelector('time');

    expect(time?.getAttribute('dateTime')).toBe(iso);
    expect(time?.textContent).toContain('m ago');
    expect(time?.getAttribute('title')).not.toBe('');
  });
});

describe('recordByline', () => {
  it('joins a lead, a verb and the relative time', () => {
    const iso = new Date(Date.now() - 60_000).toISOString();
    const { container } = render(
      <>{recordByline({ lead: 'Opened by Mara Lin', verb: 'updated', iso })}</>,
    );

    expect(container.textContent).toContain('Opened by Mara Lin');
    expect(container.textContent).toContain('updated');
    expect(container.textContent).toContain('m ago');
  });

  it('falls back to just the time when there is no lead', () => {
    const iso = new Date(Date.now() - 60_000).toISOString();
    const { container } = render(<>{recordByline({ iso })}</>);

    expect(container.textContent).not.toContain('·');
    expect(container.textContent).toContain('m ago');
  });

  it('falls back to just the lead when there is no valid time', () => {
    const { container } = render(<>{recordByline({ lead: 'Opened by Mara Lin', iso: null })}</>);

    expect(container.textContent).toBe('Opened by Mara Lin');
  });

  it('renders nothing when both lead and time are missing', () => {
    const { container } = render(<>{recordByline({ iso: null })}</>);

    expect(container.textContent).toBe('');
  });
});
