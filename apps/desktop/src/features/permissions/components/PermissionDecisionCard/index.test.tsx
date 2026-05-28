// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { TranscriptItem } from '../../../chat/utils/transcript-items';
import { PermissionDecisionCard } from './index';

afterEach(cleanup);

function makeItem(over: Partial<Extract<TranscriptItem, { kind: 'permission_decision' }>> = {}) {
  return {
    kind: 'permission_decision',
    at: '2026-05-28T03:00:00Z',
    toolUseId: 'tool-7',
    decision: 'allow',
    ruleId: null,
    ...over,
  } as Extract<TranscriptItem, { kind: 'permission_decision' }>;
}

describe('PermissionDecisionCard', () => {
  it('renders the tool use id and the allow decision', () => {
    render(<PermissionDecisionCard item={makeItem()} sessionId={null} agentId={null} />);
    expect(screen.getByText('tool-7')).toBeDefined();
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
});
