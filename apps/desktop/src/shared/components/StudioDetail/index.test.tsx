import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { resolveDetailFields } from '../../detail-fields';
import type { DetailFieldRegistry } from '../../detail-fields/types';
import { StudioWidget } from '@goodboy/ui';
import { HeaderBand } from '@goodboy/ui';
import { RailBlock } from '@goodboy/ui';
import { DetailProperties } from './DetailProperties';
import { StudioDetailTabs } from '@goodboy/ui';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type Entity = {
  readonly state: string;
  readonly author: string;
  readonly milestone: string | null;
};

const PROPERTY_ENTITY: Entity = { state: 'open', author: 'ada', milestone: null };

const PROPERTY_REGISTRY: DetailFieldRegistry<Entity> = [
  { kind: 'field', key: 'state', label: 'State', render: ({ entity }) => entity.state },
  { kind: 'field', key: 'author', label: 'Author', render: ({ entity }) => entity.author },
  {
    kind: 'field',
    key: 'milestone',
    label: 'Milestone',
    render: ({ entity }) => entity.milestone,
  },
];

describe('DetailProperties', () => {
  it('renders the properties once, in one aligned grid of columns', () => {
    render(
      <DetailProperties
        entries={resolveDetailFields({ registry: PROPERTY_REGISTRY, entity: PROPERTY_ENTITY })}
      />,
    );

    const panels = screen.getAllByTestId('detail-properties');
    expect(panels).toHaveLength(1);

    const panel = panels[0] as HTMLElement;
    expect(panel.tagName).toBe('DL');
    expect(panel.className).toContain('grid');
    expect(panel.className).toContain('auto-fill');
    expect(
      within(panel)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['State', 'Author']);
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

describe('StudioWidget', () => {
  it('renders the section label, action, and card body', () => {
    render(
      <StudioWidget
        label="description"
        presentation="section"
        action={<button type="button">Edit</button>}
      >
        <p>Body copy</p>
      </StudioWidget>,
    );

    expect(screen.getByText('description')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined();
    expect(screen.getByText('Body copy')).toBeDefined();
  });

  it('renders a frameless body without card styling', () => {
    render(
      <StudioWidget label="description" presentation="section" variant="frameless">
        <p>Primary body</p>
      </StudioWidget>,
    );

    const body = screen.getByText('Primary body').parentElement;
    expect(body?.className).toBe('');
  });
});

describe('RailBlock', () => {
  it('renders the label above its value without a description list', () => {
    const { container } = render(<RailBlock label="Reviewers">Grace Hopper</RailBlock>);

    expect(screen.getByText('Reviewers')).toBeDefined();
    expect(screen.getByText('Grace Hopper')).toBeDefined();
    expect(container.querySelector('dl')).toBeNull();
  });
});

describe('HeaderBand', () => {
  it('renders title and actions before the meta chips and subtitle', () => {
    render(
      <HeaderBand
        title="Improve detail layout"
        meta={<span>GB-42</span>}
        subtitle={<span>api/items</span>}
        actions={<a href="https://example.com">Open</a>}
      />,
    );

    const title = screen.getByRole('heading', { level: 1, name: 'Improve detail layout' });
    const meta = screen.getByText('GB-42');
    const subtitle = screen.getByText('api/items');
    const action = screen.getByRole('link', { name: 'Open' });

    expect(title.parentElement?.contains(action)).toBe(true);
    expect(title.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(meta.compareDocumentPosition(subtitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
