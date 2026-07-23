import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DetailSection } from './DetailSection';
import { HeaderBand } from './HeaderBand';
import { MetaItem } from './MetaItem';
import { StudioDetailLayout } from './StudioDetailLayout';

afterEach(cleanup);

describe('StudioDetailLayout', () => {
  it('renders the header band, main content, and metadata rail', () => {
    render(
      <StudioDetailLayout header={<span>Header slot</span>} rail={<span>Rail slot</span>}>
        <span>Main slot</span>
      </StudioDetailLayout>,
    );

    expect(screen.getByText('Header slot')).toBeDefined();
    expect(screen.getByText('Main slot')).toBeDefined();
    expect(screen.getByText('Rail slot')).toBeDefined();
  });
});

describe('DetailSection', () => {
  it('renders the section label, action, and card body', () => {
    render(
      <DetailSection label="description" action={<button type="button">Edit</button>}>
        <p>Body copy</p>
      </DetailSection>,
    );

    expect(screen.getByText('description')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined();
    expect(screen.getByText('Body copy')).toBeDefined();
  });
});

describe('MetaItem', () => {
  it('renders the label above its value', () => {
    render(<MetaItem label="Assignee">Grace Hopper</MetaItem>);

    expect(screen.getByText('Assignee')).toBeDefined();
    expect(screen.getByText('Grace Hopper')).toBeDefined();
  });
});

describe('HeaderBand', () => {
  it('renders meta chips, title, subtitle, and actions', () => {
    render(
      <HeaderBand
        meta={<span>GB-42</span>}
        title="Improve detail layout"
        subtitle={<span>api/items</span>}
        actions={<a href="https://example.com">Open</a>}
      />,
    );

    expect(screen.getByText('GB-42')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Improve detail layout' })).toBeDefined();
    expect(screen.getByText('api/items')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Open' })).toBeDefined();
  });
});
