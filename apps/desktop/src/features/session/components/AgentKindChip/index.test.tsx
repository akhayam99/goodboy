// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { tooltipTextOf } from '../../../../__tests__/helpers/tooltip';
import { AgentKindChip } from '.';
import { AGENT_KIND_ORDER, type AgentKind } from '../../agent-kind';

afterEach(cleanup);

const persistedKind = (value: string): AgentKind => JSON.parse(JSON.stringify(value));

const widthOf = ({ kind }: { readonly kind: AgentKind }): string => {
  const { container } = render(<AgentKindChip kind={kind} />);
  const chip = container.firstElementChild;
  return (chip?.className ?? '')
    .split(' ')
    .filter((token) => token.startsWith('w-'))
    .join(' ');
};

describe('AgentKindChip', () => {
  it('renders the palette label for the given kind', () => {
    render(<AgentKindChip kind="planner" />);
    expect(screen.getByText('Plan')).toBeDefined();
  });

  it('renders a different label for a different kind', () => {
    render(<AgentKindChip kind="implementer" />);
    expect(screen.getByText('Implement')).toBeDefined();
  });

  it('degrades to the stored value instead of crashing on a kind the app does not know', () => {
    render(<AgentKindChip kind={persistedKind('orchestrator')} />);
    expect(screen.getByText('orchestr…')).toBeDefined();
  });

  it('still paints a background for an unknown kind', () => {
    const { container } = render(<AgentKindChip kind={persistedKind('gremlin')} />);
    expect(container.querySelector('[class*="bg-"]')).not.toBeNull();
  });

  it('writes the generalist role out in full, uppercased by the chip styling', () => {
    render(<AgentKindChip kind="generic" />);
    const chip = screen.getByText('Generalist');
    expect(chip.className).toContain('uppercase');
  });

  it('holds one width for every role so a column of chips stays aligned', () => {
    const widths = new Set<string>();
    for (const kind of AGENT_KIND_ORDER) {
      widths.add(widthOf({ kind }));
      cleanup();
    }
    widths.add(widthOf({ kind: persistedKind('gremlin') }));

    expect(widths.size).toBe(1);
    expect([...widths][0]).toBe('w-24');
  });

  it('insets the label so the longest role never touches the chip edge', () => {
    const { container } = render(<AgentKindChip kind="pr-reviewer" />);

    expect(container.firstElementChild?.className).toContain('px-1.5');
  });

  it('applies the title attribute when provided', () => {
    const { container } = render(<AgentKindChip kind="scout" title="scout agent" />);
    expect(container.querySelector('[title="scout agent"]')).not.toBeNull();
  });

  it('exposes the role label to assistive tech', () => {
    const { container } = render(<AgentKindChip kind="tester" />);
    expect(container.querySelector('[aria-hidden]')).toBeNull();
    expect(screen.getByText('Test')).toBeDefined();
  });

  it('renders the label density by default with the kind label, or the label it is given', () => {
    render(<AgentKindChip kind="debugger" label="Debugger" />);
    expect(screen.getByText('Debugger').className).toContain('w-24');
  });

  it('renders the glyph density as the kind avatar named by its tooltip', () => {
    render(<AgentKindChip kind="planner" density="glyph" />);

    const glyph = screen.getByRole('img', { name: 'Plan' });
    expect(screen.queryByText('Plan')).toBeNull();
    expect(tooltipTextOf({ element: glyph })).toBe('Plan');
  });

  it('lets a glyph name the step it stands for', () => {
    render(<AgentKindChip kind="tester" density="glyph" title="Cover the retry path" />);
    expect(screen.getByRole('img', { name: 'Cover the retry path' })).toBeDefined();
  });
});
