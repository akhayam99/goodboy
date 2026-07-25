// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { TranscriptItem } from '../../../chat/utils/transcript-items';

vi.mock('./RetryButton', () => ({
  RetryButton: ({ toolName }: { toolName: string }) => (
    <button type="button" data-testid="retry-mock">
      retry {toolName}
    </button>
  ),
}));

import { PermissionDecisionCard } from './index';

afterEach(cleanup);

function makeItem(over: Partial<Extract<TranscriptItem, { kind: 'permission_decision' }>> = {}) {
  return {
    kind: 'permission_decision',
    at: '2026-05-28T03:00:00Z',
    toolUseId: 'tool-7',
    toolName: 'Bash',
    decision: 'allow',
    scope: 'session',
    ruleId: null,
    ...over,
  } as Extract<TranscriptItem, { kind: 'permission_decision' }>;
}

describe('PermissionDecisionCard', () => {
  it('renders the tool name and the allow decision', () => {
    render(<PermissionDecisionCard item={makeItem()} sessionId={null} agentId={null} />);
    expect(screen.getByText('Bash')).toBeDefined();
    expect(screen.getByText('allow')).toBeDefined();
  });

  it('renders a rule id chip when present', () => {
    render(
      <PermissionDecisionCard
        item={makeItem({ decision: 'deny', ruleId: 'rule-42' as never })}
        sessionId={null}
        agentId={null}
      />,
    );
    expect(screen.getByText('rule-42')).toBeDefined();
    expect(screen.getByText('deny')).toBeDefined();
  });

  it('offers a retry affordance for a session-scoped allow with a session and agent', () => {
    render(
      <PermissionDecisionCard
        item={makeItem()}
        sessionId={'sess' as never}
        agentId={'agent' as never}
      />,
    );
    expect(screen.getByTestId('retry-mock')).toBeDefined();
  });

  it('offers no retry affordance for a deny decision', () => {
    render(
      <PermissionDecisionCard
        item={makeItem({ decision: 'deny', scope: 'deny' })}
        sessionId={'sess' as never}
        agentId={'agent' as never}
      />,
    );
    expect(screen.queryByTestId('retry-mock')).toBeNull();
  });

  it('explains instead of offering a retry when the allow was scoped once', () => {
    render(
      <PermissionDecisionCard
        item={makeItem({ scope: 'once' })}
        sessionId={'sess' as never}
        agentId={'agent' as never}
      />,
    );
    expect(screen.queryByTestId('retry-mock')).toBeNull();
    expect(screen.getByText(/cannot carry into a new run/)).toBeDefined();
  });

  it('offers no retry affordance for a persisted decision without a scope', () => {
    render(
      <PermissionDecisionCard
        item={makeItem({ scope: undefined })}
        sessionId={'sess' as never}
        agentId={'agent' as never}
      />,
    );
    expect(screen.queryByTestId('retry-mock')).toBeNull();
    expect(screen.getByText('Bash')).toBeDefined();
  });
});
