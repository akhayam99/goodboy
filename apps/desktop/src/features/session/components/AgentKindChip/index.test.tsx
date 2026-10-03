// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { tooltipTextOf } from '../../../../__tests__/helpers/tooltip';
import { AgentKindChip } from '.';
import { AGENT_KIND_ORDER, type AgentKind } from '../../agent-kind';

afterEach(cleanup);

const persistedKind = (value: string): AgentKind => JSON.parse(JSON.stringify(value));

describe('AgentKindChip', () => {
  it('renders the palette label for the given kind', () => {
    render(<AgentKindChip kind="planner" />);
    expect(screen.getByText('Planner')).toBeDefined();
  });

  it('renders a different label for a different kind', () => {
    render(<AgentKindChip kind="implementer" />);
    expect(screen.getByText('Implementer')).toBeDefined();
  });

  it('degrades to the stored value instead of crashing on a kind the app does not know', () => {
    render(<AgentKindChip kind={persistedKind('orchestrator')} />);
    expect(screen.getByText('orchestr…')).toBeDefined();
  });

  it('still paints a background for an unknown kind', () => {
    const { container } = render(<AgentKindChip kind={persistedKind('gremlin')} />);
    expect(container.querySelector('[class*="bg-"]')).not.toBeNull();
  });

  it('writes the generalist role out in full, in sentence case', () => {
    render(<AgentKindChip kind="generic" />);
    const chip = screen.getByText('Generalist');
    expect(chip.className).not.toContain('uppercase');
  });

  it('lets every chip hug its word instead of padding the short roles to one width', () => {
    const widths = AGENT_KIND_ORDER.map((kind) => {
      const { container } = render(<AgentKindChip kind={kind} />);
      const width = (container.firstElementChild?.className ?? '')
        .split(' ')
        .filter((token) => token.startsWith('w-') || token.startsWith('min-w-'));
      cleanup();
      return width;
    });

    expect(widths.every((tokens) => tokens.length === 0)).toBe(true);
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
    expect(screen.getByText('Tester')).toBeDefined();
  });

  it('renders the label density by default with the kind label, or the label it is given', () => {
    render(<AgentKindChip kind="debugger" label="Bug hunter" />);
    expect(screen.getByText('Bug hunter')).toBeDefined();
    expect(screen.queryByText('Debugger')).toBeNull();
  });

  it('renders the glyph density as the kind avatar named by its tooltip', () => {
    render(<AgentKindChip kind="planner" density="glyph" />);

    const glyph = screen.getByRole('img', { name: 'Planner' });
    expect(screen.queryByText('Planner')).toBeNull();
    expect(tooltipTextOf({ element: glyph })).toBe('Planner');
  });

  it('lets a glyph name the step it stands for', () => {
    render(<AgentKindChip kind="tester" density="glyph" title="Cover the retry path" />);
    expect(screen.getByRole('img', { name: 'Cover the retry path' })).toBeDefined();
  });
});
