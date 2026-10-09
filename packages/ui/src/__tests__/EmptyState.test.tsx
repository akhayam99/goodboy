// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { EmptyState, FilledEmptyState } from '../components/EmptyState';

afterEach(cleanup);

const CIRCLE = /\brounded-full\b|\bsize-12\b|\bbg-fill\b/;

const hasCircle = (container: HTMLElement): boolean =>
  Array.from(container.querySelectorAll('*')).some((element) =>
    CIRCLE.test(element.getAttribute('class') ?? ''),
  );

describe('EmptyState page', () => {
  it('draws a bare 18px muted icon, the title as an h2 and one sentence under it', () => {
    const { container } = render(
      <EmptyState
        icon={Inbox}
        size="page"
        title="No runs yet"
        description="A run is a workflow working on this session."
        action={<button type="button">Start a run</button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'No runs yet' })).toBeTruthy();
    expect(screen.getByText('A run is a workflow working on this session.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start a run' })).toBeTruthy();
    const icon = container.querySelector('svg');
    expect(icon?.getAttribute('width')).toBe('18');
    expect(icon?.getAttribute('class')).toContain('text-muted-foreground');
    expect(hasCircle(container)).toBe(false);
  });

  it('lets a caller pick another heading level, and never draws a border', () => {
    const { container } = render(
      <EmptyState icon={Inbox} size="page" headingLevel={3} title="No notes" />,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'No notes' })).toBeTruthy();
    expect(container.innerHTML).not.toContain('border-dashed');
  });
});

describe('EmptyState section', () => {
  it('is one line with no card, no padding block and no heading', () => {
    const { container } = render(
      <EmptyState
        icon={Inbox}
        size="section"
        title="No runs or agents yet"
        description="Start one from the actions above."
        action={<button type="button">See Log</button>}
      />,
    );

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('No runs or agents yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'See Log' })).toBeTruthy();
    const root = container.firstElementChild;
    expect(root?.className).not.toMatch(/\bp[yb]?-\d/);
    expect(root?.className).not.toMatch(/\bbg-/);
    expect(root?.className).not.toContain('border');
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('14');
    expect(hasCircle(container)).toBe(false);
  });
});

describe('EmptyState layouts', () => {
  it.each([2, 3] as const)(
    'renders a page at heading level %s without a circle',
    (headingLevel) => {
      const { container } = render(
        <EmptyState icon={Inbox} size="page" headingLevel={headingLevel} title="Large state" />,
      );

      expect(screen.getByText('Large state')).toBeTruthy();
      expect(container.firstElementChild?.className).toContain('flex-col items-center');
      expect(hasCircle(container)).toBe(false);
    },
  );

  it.each(['No rows', 'No results'] as const)('renders a section titled %s', (title) => {
    const { container } = render(<EmptyState icon={Inbox} size="section" title={title} />);

    expect(screen.getByText(title)).toBeTruthy();
    expect(container.firstElementChild?.className).toContain('min-h-7');
    expect(screen.queryByRole('heading')).toBeNull();
    expect(hasCircle(container)).toBe(false);
  });

  it('keeps the default title unheaded and renders a requested heading level', () => {
    render(
      <div>
        <EmptyState icon={Inbox} size="page" title="Semantic title" headingLevel={2} />
        <EmptyState icon={Inbox} title="Default title" />
      </div>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Semantic title' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Default title' })).toBeNull();
  });

  it('renders a bordered state as a page without the border', () => {
    const { container } = render(<EmptyState icon={Inbox} bordered title="Bordered state" />);

    expect(container.firstElementChild?.className).toContain('flex-col items-center');
    expect(container.innerHTML).not.toContain('border');
  });
});

describe('EmptyState wrappers', () => {
  it('draws explicit sections and the remaining host wrapper with the same props', () => {
    const { container } = render(
      <div>
        <EmptyState
          size="section"
          icon={Inbox}
          title="No lens rows"
          description="Nothing to list here."
        />
        <FilledEmptyState icon={Inbox} title="No filled rows" />
      </div>,
    );

    expect(screen.getByText('No lens rows')).toBeTruthy();
    expect(screen.getByText('Nothing to list here.')).toBeTruthy();
    expect(screen.getByText('No filled rows')).toBeTruthy();
    expect(container.querySelectorAll('.min-h-7')).toHaveLength(2);
    expect(hasCircle(container)).toBe(false);
  });
});
