// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

vi.mock('../../../../resolve/components/ResolvePublishStrip', () => ({
  ResolvePublishStrip: () => <div data-testid="publish-strip" />,
}));

import { PublishConversationsBar } from './index';

const SESSION_ID = 'session-1' as SessionId;

afterEach(cleanup);

describe('PublishConversationsBar', () => {
  it('holds only the publication of the conversations', () => {
    render(<PublishConversationsBar sessionId={SESSION_ID} />);

    expect(screen.getByTestId('publish-strip')).toBeDefined();
    for (const name of [/Write review/, /PR details/, /PR activity/, /Checks/]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });
});
