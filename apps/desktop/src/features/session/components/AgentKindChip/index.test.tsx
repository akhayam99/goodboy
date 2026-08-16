// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AgentKindChip } from '.';
import type { AgentKind } from '../../agent-kind';

afterEach(cleanup);

const persistedKind = (value: string): AgentKind => JSON.parse(JSON.stringify(value));

describe('AgentKindChip', () => {
  it('renders the palette label for the given kind', () => {
    render(<AgentKindChip kind="planner" />);
    expect(screen.getByText('plan')).toBeDefined();
  });

  it('renders a different label for a different kind', () => {
    render(<AgentKindChip kind="implementer" />);
    expect(screen.getByText('implement')).toBeDefined();
  });

  it('degrades to the stored value instead of crashing on a kind the app does not know', () => {
    render(<AgentKindChip kind={persistedKind('orchestrator')} />);
    expect(screen.getByText('orchestr…')).toBeDefined();
  });

  it('still paints a background for an unknown kind', () => {
    const { container } = render(<AgentKindChip kind={persistedKind('gremlin')} />);
    expect(container.querySelector('[class*="bg-"]')).not.toBeNull();
  });

  it('renders GEN for the generalist role, uppercased by the chip styling', () => {
    render(<AgentKindChip kind="generic" />);
    const chip = screen.getByText('gen');
    expect(chip.className).toContain('uppercase');
  });

  it('applies the title attribute when provided', () => {
    const { container } = render(<AgentKindChip kind="scout" title="scout agent" />);
    expect(container.querySelector('[title="scout agent"]')).not.toBeNull();
  });

  it('marks the chip as aria-hidden so screen readers skip it', () => {
    const { container } = render(<AgentKindChip kind="tester" />);
    expect(container.querySelector('[aria-hidden]')).not.toBeNull();
  });
});
