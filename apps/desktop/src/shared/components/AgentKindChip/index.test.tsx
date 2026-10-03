// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { tooltipTextOf } from '../../../__tests__/helpers/tooltip';
import { AgentKindChip } from '.';
import {
  AGENT_KIND_ORDER,
  agentKindPalette,
  type AgentKind,
} from '../../../features/session/agent-kind';

afterEach(cleanup);

const persistedKind = (value: string): AgentKind => JSON.parse(JSON.stringify(value));

describe('AgentKindChip', () => {
  it('renders the palette label for the given kind', () => {
    render(<AgentKindChip kind="planner" />);
    screen.getByText('Planner');
  });

  it('renders a different label for a different kind', () => {
    render(<AgentKindChip kind="implementer" />);
    screen.getByText('Implementer');
  });

  it('degrades to the stored value and a fallback icon on a kind the app does not know', () => {
    const { container } = render(<AgentKindChip kind={persistedKind('orchestrator')} />);
    screen.getByText('orchestr…');
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('leads every kind with its own icon from the kind registry, never a bare dot', () => {
    const icons = new Set(AGENT_KIND_ORDER.map((kind) => agentKindPalette({ kind }).icon));
    for (const kind of AGENT_KIND_ORDER) {
      const { container } = render(<AgentKindChip kind={kind} />);
      expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      screen.getByText(agentKindPalette({ kind }).label);
      cleanup();
    }

    expect(icons.size).toBe(AGENT_KIND_ORDER.length);
  });

  it('applies the title attribute when provided', () => {
    const { container } = render(<AgentKindChip kind="scout" title="scout agent" />);
    expect(container.querySelector('[title="scout agent"]')).not.toBeNull();
  });

  it('renders the label density by default with the kind label, or the label it is given', () => {
    render(<AgentKindChip kind="debugger" label="Bug hunter" />);
    screen.getByText('Bug hunter');
    expect(screen.queryByText('Debugger')).toBeNull();
  });

  it('renders the glyph density as the kind icon named by its tooltip', () => {
    render(<AgentKindChip kind="planner" density="glyph" />);

    const glyph = screen.getByRole('img', { name: 'Planner' });
    expect(screen.queryByText('Planner')).toBeNull();
    expect(glyph.querySelector('svg')).not.toBeNull();
    expect(tooltipTextOf({ element: glyph })).toBe('Planner');
  });

  it('lets a glyph name the step it stands for', () => {
    render(<AgentKindChip kind="tester" density="glyph" title="Cover the retry path" />);
    screen.getByRole('img', { name: 'Cover the retry path' });
  });
});
