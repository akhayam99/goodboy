import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { resolveDetailFields, type DetailFieldRegistry } from '../../detail-fields';
import { DetailSection } from './DetailSection';
import { HeaderBand } from './HeaderBand';
import { RailBlock } from './RailBlock';
import { StudioDetailLayout } from './StudioDetailLayout';
import { StudioDetailTabs } from './StudioDetailTabs';

afterEach(cleanup);

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
      <StudioDetailLayout
        header={<span>Header slot</span>}
        rail={<span>Rail slot</span>}
        properties={resolveDetailFields({ registry: PROPERTY_REGISTRY, entity: PROPERTY_ENTITY })}
        fit="bleed"
      >
        <span>Main slot</span>
      </StudioDetailLayout>,
    );

    expect(screen.getByText('Main slot')).toBeDefined();
    expect(screen.queryByText('Rail slot')).toBeNull();
    expect(screen.queryByTestId('detail-properties')).toBeNull();
  });

  it('bounds the rail extras below lg and keeps the properties out of the scroll region', () => {
    render(
      <StudioDetailLayout
        header={<span>Header slot</span>}
        rail={<span>Rail slot</span>}
        properties={resolveDetailFields({ registry: PROPERTY_REGISTRY, entity: PROPERTY_ENTITY })}
      >
        <span>Main slot</span>
      </StudioDetailLayout>,
    );

    const extras = screen.getByText('Rail slot').closest('div.max-h-64');
    expect(extras).not.toBeNull();
    expect((extras as HTMLElement).className).toContain('lg:max-h-none');
    expect(screen.getByTestId('detail-properties').closest('div.max-h-64')).toBeNull();
  });

  it('pins the header band while a flow body scrolls', () => {
    render(
      <StudioDetailLayout header={<span>Header slot</span>} fit="flow">
        <span>Main slot</span>
      </StudioDetailLayout>,
    );

    const band = screen.getByTestId('detail-header-band');
    expect(band.className).toContain('sticky');
    expect(band.className).toContain('top-0');
    expect(band.className).toContain('bg-background');
  });

  it('renders the properties once, as a wrapping row below lg and a column from lg', () => {
    render(
      <StudioDetailLayout
        header={<span>Header slot</span>}
        rail={<span>Rail slot</span>}
        properties={resolveDetailFields({ registry: PROPERTY_REGISTRY, entity: PROPERTY_ENTITY })}
      >
        <span>Main slot</span>
      </StudioDetailLayout>,
    );

    const panels = screen.getAllByTestId('detail-properties');
    expect(panels).toHaveLength(1);

    const panel = panels[0] as HTMLElement;
    expect(panel.tagName).toBe('DL');
    expect(panel.className).toContain('flex-row flex-wrap');
    expect(panel.className).toContain('lg:flex-col');
    expect(
      within(panel)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['State', 'Author']);
  });

  it('keeps the properties visible at every width', () => {
    const { container } = render(
      <StudioDetailLayout
        header={<span>Header slot</span>}
        properties={resolveDetailFields({ registry: PROPERTY_REGISTRY, entity: PROPERTY_ENTITY })}
      >
        <span>Main slot</span>
      </StudioDetailLayout>,
    );

    const panel = screen.getByTestId('detail-properties');
    const hidden: Array<string> = [];
    let node: HTMLElement | null = panel;
    while (node != null && node !== container) {
      const classes = node.className.split(' ');
      hidden.push(...classes.filter((entry) => /^(?:[a-z]+:)?hidden$/.test(entry)));
      node = node.parentElement;
    }

    expect(hidden).toEqual([]);
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

describe('RailBlock', () => {
  it('renders the label above its value without a description list', () => {
    const { container } = render(<RailBlock label="Reviewers">Grace Hopper</RailBlock>);

    expect(screen.getByText('Reviewers')).toBeDefined();
    expect(screen.getByText('Grace Hopper')).toBeDefined();
    expect(container.querySelector('dl')).toBeNull();
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
