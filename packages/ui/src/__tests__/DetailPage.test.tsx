// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DetailPage } from '../components/DetailPage';

afterEach(cleanup);

const SECTIONS = [
  { id: 'body', title: 'Description', children: <p>the body</p> },
  { id: 'activity', title: 'Activity', children: <p>the activity</p>, defaultCollapsed: true },
];

describe('DetailPage', () => {
  it('pins the title, the state and the actions in the header', () => {
    render(
      <DetailPage
        title="Issue 42"
        eyebrow="linear"
        state={<span>open</span>}
        actions={<button type="button">Close issue</button>}
        sections={SECTIONS}
      />,
    );

    const header = screen.getByRole('heading', { name: 'Issue 42' }).parentElement?.parentElement
      ?.parentElement;
    expect(header?.className).toContain('sticky');
    expect(screen.getByText('open')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Close issue' })).toBeDefined();
  });

  it('opens the sections that are not collapsed by default', () => {
    render(<DetailPage title="Issue 42" sections={SECTIONS} />);

    expect(screen.getByText('the body')).toBeDefined();
    expect(screen.queryByText('the activity')).toBeNull();
  });

  it('toggles a section from its trigger', () => {
    render(<DetailPage title="Issue 42" sections={SECTIONS} />);

    fireEvent.click(screen.getByRole('button', { name: 'Activity' }));
    expect(screen.getByText('the activity')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Activity' }));
    expect(screen.queryByText('the activity')).toBeNull();
  });

  it('renders the meta block and the footer around the body', () => {
    render(
      <DetailPage
        title="Issue 42"
        meta={<span>meta block</span>}
        footer={<span>footer block</span>}
        sections={SECTIONS}
      />,
    );

    expect(screen.getByText('meta block')).toBeDefined();
    expect(screen.getByText('footer block')).toBeDefined();
  });
});
