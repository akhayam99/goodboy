import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { resolveDetailFields, type DetailFieldRegistry } from '../../detail-fields';
import { StudioWidget } from '@goodboy/ui';
import { HeaderBand } from '@goodboy/ui';
import { RailBlock } from '@goodboy/ui';
import { StudioDetailLayout } from './StudioDetailLayout';
import { StudioDetailTabs } from '@goodboy/ui';
import { STORAGE_KEYS } from '../../lib/storage-keys';

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

const scrollAncestors = ({ node }: { readonly node: HTMLElement }) => {
  const found: Array<HTMLElement> = [];
  let current: HTMLElement | null = node;
  while (current != null) {
    if (current.className.includes('overflow-y-auto')) {
      found.push(current);
    }
    current = current.parentElement;
  }
  return found;
};

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

  it('keeps the header measure constant across fit modes', () => {
    const { unmount } = render(
      <StudioDetailLayout header={<span>Header slot</span>} fit="fill">
        <span>Main slot</span>
      </StudioDetailLayout>,
    );
    const fillHeaderMeasure = screen.getByTestId('detail-header-band').querySelector('.max-w-3xl');
    expect(fillHeaderMeasure).not.toBeNull();
    unmount();

    render(
      <StudioDetailLayout header={<span>Header slot</span>} fit="bleed">
        <span>Main slot</span>
      </StudioDetailLayout>,
    );
    const bleedHeaderMeasure = screen.getByTestId('detail-header-band').querySelector('.max-w-3xl');
    expect(bleedHeaderMeasure).not.toBeNull();
    expect(screen.getByTestId('detail-header-band').querySelector('.max-w-none')).toBeNull();
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

  it('docks the action below the body, outside every scroll region', () => {
    render(
      <StudioDetailLayout
        header={<span>Header slot</span>}
        dock={<button type="button">Launch session</button>}
        properties={resolveDetailFields({ registry: PROPERTY_REGISTRY, entity: PROPERTY_ENTITY })}
      >
        <span>Main slot</span>
      </StudioDetailLayout>,
    );

    const action = screen.getByRole('button', { name: 'Launch session' });
    const dock = screen.getByTestId('detail-dock');
    const scroller = screen.getByText('Main slot').closest('.overflow-y-auto');

    expect(scrollAncestors({ node: action })).toEqual([]);
    expect(dock.contains(action)).toBe(true);
    expect(scroller).not.toBeNull();
    expect((dock.parentElement as HTMLElement).contains(scroller as HTMLElement)).toBe(true);
  });

  it('leaves the meta to the properties when the action is docked', () => {
    render(
      <StudioDetailLayout
        header={<span>Header slot</span>}
        dock={<button type="button">Launch session</button>}
        properties={resolveDetailFields({ registry: PROPERTY_REGISTRY, entity: PROPERTY_ENTITY })}
      >
        <span>Main slot</span>
      </StudioDetailLayout>,
    );

    const meta = screen.getByTestId('detail-meta');

    expect(meta.contains(screen.getByTestId('detail-properties'))).toBe(true);
    expect(meta.contains(screen.getByRole('button', { name: 'Launch session' }))).toBe(false);
    expect(meta.querySelector('[role="separator"]')).toBeNull();
  });

  it('carries the meta in the header band, never in a side column', () => {
    render(
      <StudioDetailLayout
        header={<span>Header slot</span>}
        rail={<button type="button">Launch session</button>}
        properties={resolveDetailFields({ registry: PROPERTY_REGISTRY, entity: PROPERTY_ENTITY })}
      >
        <span>Main slot</span>
      </StudioDetailLayout>,
    );

    const band = screen.getByTestId('detail-header-band');
    const meta = screen.getByTestId('detail-meta');
    expect(band.contains(meta)).toBe(true);
    expect(meta.contains(screen.getByTestId('detail-properties'))).toBe(true);
    expect(meta.contains(screen.getByRole('button', { name: 'Launch session' }))).toBe(true);
    expect(scrollAncestors({ node: meta })).toEqual([]);
    expect(band.contains(screen.getByText('Main slot'))).toBe(false);
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

  it('keeps the meta on the header measure in flow mode', () => {
    render(
      <StudioDetailLayout
        header={<span>Header slot</span>}
        properties={resolveDetailFields({ registry: PROPERTY_REGISTRY, entity: PROPERTY_ENTITY })}
        fit="flow"
      >
        <span>Main slot</span>
      </StudioDetailLayout>,
    );

    const band = screen.getByTestId('detail-header-band');
    const meta = screen.getByTestId('detail-meta');
    expect(band.contains(meta)).toBe(true);
    expect((meta.parentElement as HTMLElement).contains(screen.getByText('Header slot'))).toBe(
      true,
    );
  });

  it('renders the properties once, in one aligned grid of columns', () => {
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
    expect(panel.className).toContain('grid');
    expect(panel.className).toContain('auto-fill');
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

  it('gives the body the full width, with no column to resize', () => {
    render(
      <StudioDetailLayout header={<span>Header slot</span>} rail={<span>Rail slot</span>}>
        <span>Main slot</span>
      </StudioDetailLayout>,
    );

    expect(screen.queryByRole('separator', { name: 'Resize studio detail rail' })).toBeNull();
    const body = screen.getByText('Main slot').closest('.overflow-y-auto');
    expect(body).not.toBeNull();
    expect((body as HTMLElement).contains(screen.getByText('Rail slot'))).toBe(false);
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
