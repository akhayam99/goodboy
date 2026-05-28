// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { TranscriptItem } from '../../../chat/utils/transcript-items';

vi.mock('../PermissionScopePicker', () => ({
  PermissionScopePicker: ({ onResolved }: { onResolved: () => void }) => (
    <button type="button" data-testid="scope-picker-mock" onClick={onResolved}>
      mock-picker
    </button>
  ),
}));

import { PermissionRequestCard } from './index';

afterEach(cleanup);

function makeItem(): Extract<TranscriptItem, { kind: 'permission_request' }> {
  return {
    kind: 'permission_request',
    at: '2026-05-28T03:00:00Z',
    toolUseId: 'tu-1',
    toolName: 'bash',
    runId: 'run-1',
  } as Extract<TranscriptItem, { kind: 'permission_request' }>;
}

describe('PermissionRequestCard', () => {
  it('renders the tool name and the scope picker when sessionId and agentId are provided', () => {
    render(
      <PermissionRequestCard
        item={makeItem()}
        sessionId={'sess' as never}
        agentId={'agent' as never}
      />,
    );
    expect(screen.getByText('bash')).toBeDefined();
    expect(screen.getByTestId('scope-picker-mock')).toBeDefined();
  });

  it('does not render a scope picker when sessionId is missing', () => {
    render(<PermissionRequestCard item={makeItem()} sessionId={null} agentId={null} />);
    expect(screen.queryByTestId('scope-picker-mock')).toBeNull();
  });
});
