// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgentRole, ProviderId } from '@goodboy/types';
import type { AgentKind } from '../../agent-kind';
import type { EffortLevel } from '../../../chat/utils/chat-constants';

vi.mock('../RoleSelect', () => ({
  RoleSelect: ({ onChange }: { onChange: (v: string) => void }) => (
    <button type="button" onClick={() => onChange('engineer')}>
      role-select
    </button>
  ),
}));

vi.mock('../../../../shared/components/AgentAvatar', () => ({
  AgentAvatar: ({ kind }: { kind: string }) => <span data-testid="agent-avatar">{kind}</span>,
}));

import { WorkflowStepCard } from './index';

const baseProps = {
  ordinal: 0,
  kind: 'scout' as AgentKind,
  role: 'scout' as AgentRole,
  provider: 'anthropic' as ProviderId,
  providerValue: '' as ProviderId | '',
  recommendedProvider: 'anthropic' as ProviderId,
  connectedProviders: ['anthropic'] as ReadonlyArray<ProviderId>,
  name: 'Scout',
  promptPrefix: 'Find the relevant files.',
  model: '',
  resolvedModel: 'claude-haiku-4-5',
  recommendedModel: 'claude-haiku-4-5',
  effort: 'medium' as EffortLevel,
  verbosity: 'normal' as const,
  expanded: false,
  dragging: false,
  disabled: false,
  polishing: false,
  onExpand: vi.fn(),
  onCollapse: vi.fn(),
  onStartDrag: vi.fn(),
  onName: vi.fn(),
  onPrompt: vi.fn(),
  onModel: vi.fn(),
  onProvider: vi.fn(),
  onEffort: vi.fn(),
  onVerbosity: vi.fn(),
  onRemove: vi.fn(),
  onMoveUp: vi.fn(),
  onMoveDown: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WorkflowStepCard (collapsed)', () => {
  it('reads as one dense row: resolved model, no raw id, no picker', () => {
    render(<WorkflowStepCard {...baseProps} />);
    expect(screen.getByText('Haiku 4.5')).toBeDefined();
    expect(screen.queryByText('claude-haiku-4-5')).toBeNull();
    expect(screen.queryByRole('button', { name: /^routing for step 1:/ })).toBeNull();
  });

  it('shows the clamped effort for the resolved model', () => {
    render(<WorkflowStepCard {...baseProps} resolvedModel="claude-sonnet-4-6" effort="max" />);
    expect(screen.getByText('High')).toBeDefined();
    expect(screen.queryByText('Max')).toBeNull();
  });

  it('clicking the card button calls onExpand', () => {
    const onExpand = vi.fn();
    render(<WorkflowStepCard {...baseProps} onExpand={onExpand} />);
    fireEvent.click(screen.getByRole('button', { name: /^step 1:/i }));
    expect(onExpand).toHaveBeenCalledOnce();
  });
});

describe('WorkflowStepCard (expanded)', () => {
  it('renders name input and prompt textarea when expanded', () => {
    render(<WorkflowStepCard {...baseProps} expanded={true} />);
    expect(screen.getByPlaceholderText('step name')).toBeDefined();
    expect(screen.getByPlaceholderText(/role instructions/i)).toBeDefined();
  });

  it('clicking remove button calls onRemove', () => {
    const onRemove = vi.fn();
    render(<WorkflowStepCard {...baseProps} expanded={true} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /remove step/i }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('ignores focusout without a related target and collapses for an outside target', () => {
    const onCollapse = vi.fn();
    render(
      <>
        <WorkflowStepCard {...baseProps} expanded={true} onCollapse={onCollapse} />
        <button type="button">outside</button>
      </>,
    );
    const card = screen.getByRole('listitem');

    fireEvent.focusOut(card, { relatedTarget: null });
    expect(onCollapse).not.toHaveBeenCalled();

    fireEvent.focusOut(card, { relatedTarget: screen.getByRole('button', { name: 'outside' }) });
    expect(onCollapse).toHaveBeenCalledOnce();
  });

  it('stays expanded when focus and pointer events move into a dropdown portal', () => {
    const onCollapse = vi.fn();
    render(
      <>
        <WorkflowStepCard {...baseProps} expanded={true} onCollapse={onCollapse} />
        <div data-dropdown-portal>
          <button type="button">portal option</button>
        </div>
      </>,
    );
    const card = screen.getByRole('listitem');
    const portalOption = screen.getByRole('button', { name: 'portal option' });

    fireEvent.focusOut(card, { relatedTarget: portalOption });
    fireEvent.mouseDown(portalOption);

    expect(onCollapse).not.toHaveBeenCalled();
  });

  it('wand button renders when onPolish is provided, absent when not provided', () => {
    const onPolish = vi.fn();
    const { unmount } = render(
      <WorkflowStepCard {...baseProps} expanded={true} onPolish={onPolish} />,
    );
    expect(screen.getByRole('button', { name: /polish step instruction/i })).toBeDefined();
    unmount();

    render(<WorkflowStepCard {...baseProps} expanded={true} />);
    expect(screen.queryByRole('button', { name: /polish step instruction/i })).toBeNull();
  });

  it('changes verbosity through the routing picker', () => {
    const onVerbosity = vi.fn();
    render(<WorkflowStepCard {...baseProps} expanded={true} onVerbosity={onVerbosity} />);
    fireEvent.click(screen.getByRole('button', { name: /^routing for step 1:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Verbose' }));
    expect(onVerbosity).toHaveBeenCalledWith('verbose');
  });
});
