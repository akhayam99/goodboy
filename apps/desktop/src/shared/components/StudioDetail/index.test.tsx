import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DetailSection } from './DetailSection';
import { HeaderBand } from './HeaderBand';
import { MetaItem } from './MetaItem';
import { StudioDetailLayout } from './StudioDetailLayout';
import { StudioDetailTabs } from './StudioDetailTabs';

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

  it('renders the optional tab bar between the header and the body', () => {
    render(
      <StudioDetailLayout
        header={<span>Header slot</span>}
        rail={<span>Rail slot</span>}
        tabs={<span>Tabs slot</span>}
      >
        <span>Main slot</span>
      </StudioDetailLayout>,
    );

    expect(screen.getByText('Tabs slot')).toBeDefined();
  });

  it('drops the rail and the scroll region for a full-bleed body', () => {
    render(
      <StudioDetailLayout header={<span>Header slot</span>} scrolls={false}>
        <span>Main slot</span>
      </StudioDetailLayout>,
    );

    expect(screen.getByText('Main slot')).toBeDefined();
    expect(screen.queryByText('Rail slot')).toBeNull();
  });
});

describe('StudioDetailTabs', () => {
  it('switches section on click', () => {
    const onChange = vi.fn();
    render(
      <StudioDetailTabs
        ariaLabel="Issue sections"
        value="overview"
        onChange={onChange}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'conversation', label: 'Conversation' },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Conversation' }));

    expect(onChange).toHaveBeenCalledWith('conversation');
  });

  it('renders nothing when there is a single section', () => {
    render(
      <StudioDetailTabs
        ariaLabel="Issue sections"
        value="overview"
        onChange={vi.fn()}
        options={[{ value: 'overview', label: 'Overview' }]}
      />,
    );

    expect(screen.queryByRole('tablist')).toBeNull();
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
