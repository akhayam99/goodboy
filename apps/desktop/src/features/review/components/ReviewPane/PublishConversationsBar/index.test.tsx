// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import type { ReviewMode } from '../../../reviewMode';

vi.mock('../../../../resolve/components/ResolvePublishStrip', () => ({
  ResolvePublishStrip: () => <div data-testid="publish-strip" />,
}));

import { PublishConversationsBar } from './index';

const SESSION_ID = 'session-1' as SessionId;

const renderBar = (mode: ReviewMode) =>
  render(
    <PublishConversationsBar
      sessionId={SESSION_ID}
      draftCount={0}
      mode={mode}
      onSelectMode={vi.fn()}
    />,
  );

afterEach(cleanup);

describe('PublishConversationsBar', () => {
  it('offers the publish strip on the queue, where the decisions are made', () => {
    renderBar('queue');
    expect(screen.getByTestId('publish-strip')).toBeDefined();
  });

  it.each(['pr_details', 'pr_activity', 'checks', 'create_pr'] as const)(
    'hides the publish strip on %s, so the machine cannot be driven from elsewhere',
    (mode) => {
      renderBar(mode);
      expect(screen.queryByTestId('publish-strip')).toBeNull();
    },
  );

  it('keeps the four mode buttons in every mode', () => {
    renderBar('checks');
    expect(screen.getByRole('button', { name: /Write review/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /PR details/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /PR activity/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Checks/ })).toBeDefined();
  });
});
