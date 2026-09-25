// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Inbox, Mail } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FacetKeyHints } from './FacetKeyHints';
import { FacetRow } from './FacetRow';
import { FacetSection } from './FacetSection';
import { FacetRail } from '.';

afterEach(cleanup);

describe('FacetRail', () => {
  it('names the rail and each section, and marks the selected row current', () => {
    const onUnread = vi.fn();
    render(
      <FacetRail ariaLabel="Filter items">
        <FacetSection label="View">
          <FacetRow icon={Inbox} label="All" count={12} isSelected onClick={vi.fn()} />
          <FacetRow icon={Mail} label="Unread" count={3} isSelected={false} onClick={onUnread} />
        </FacetSection>
      </FacetRail>,
    );

    const view = within(screen.getByRole('navigation', { name: 'Filter items' })).getByRole(
      'region',
      { name: 'View' },
    );
    const all = within(view).getByRole('button', { name: /All/ });
    const unread = within(view).getByRole('button', { name: /Unread/ });

    expect(all.getAttribute('aria-current')).toBe('true');
    expect(unread.getAttribute('aria-current')).toBeNull();
    expect(within(unread).getByText('3')).toBeDefined();

    fireEvent.click(unread);
    expect(onUnread).toHaveBeenCalledTimes(1);
  });

  it('fades a row with nothing in it unless it is selected', () => {
    render(
      <FacetSection label="Source">
        <FacetRow icon={Inbox} label="Empty" count={0} isSelected={false} onClick={vi.fn()} />
        <FacetRow icon={Mail} label="Picked" count={0} isSelected onClick={vi.fn()} />
      </FacetSection>,
    );

    expect(screen.getByText('Empty').className).toContain('text-faint-foreground');
    expect(screen.getByText('Picked').className).not.toContain('text-faint-foreground');
  });

  it('lists every key hint with its keys', () => {
    render(
      <FacetKeyHints
        hints={[
          { keys: ['j', 'k'], label: 'Next or previous' },
          { keys: ['e'], label: 'Dismiss' },
        ]}
      />,
    );

    expect(screen.getByText('Keys')).toBeDefined();
    expect(screen.getByText('Next or previous')).toBeDefined();
    expect(screen.getByText('j')).toBeDefined();
    expect(screen.getByText('k')).toBeDefined();
    expect(screen.getByText('Dismiss')).toBeDefined();
  });
});
