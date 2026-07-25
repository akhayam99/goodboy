// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { WorkflowAttachButton } from './index';

const SESSION_ID = 'session-1' as SessionId;

afterEach(cleanup);

describe('WorkflowAttachButton', () => {
  it('opens the builder for the session from either placement', () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:open-workflow-builder', listener);

    render(<WorkflowAttachButton sessionId={SESSION_ID} placement="header" />);
    fireEvent.click(screen.getByRole('button', { name: 'Attach another workflow' }));
    cleanup();
    render(<WorkflowAttachButton sessionId={SESSION_ID} placement="inline" />);
    fireEvent.click(screen.getByRole('button', { name: 'Attach another workflow' }));

    window.removeEventListener('goodboy:open-workflow-builder', listener);
    expect(listener).toHaveBeenCalledTimes(2);
    const event = listener.mock.calls[0]![0] as CustomEvent<{ sessionId: string }>;
    expect(event.detail.sessionId).toBe(SESSION_ID);
  });
});
