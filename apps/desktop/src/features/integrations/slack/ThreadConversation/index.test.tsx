// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import type { SlackMessage, SlackReaction } from '../client';
import type { SlackThreadActions } from '../useSlackThreadActions';
import { ThreadConversation } from './index';

const ROOT_TS = '1723456789.123456';
const REPLY_TS = '1723456999.000100';

type MessageParams = {
  readonly ts: string;
  readonly text: string;
  readonly reactions?: ReadonlyArray<SlackReaction>;
};

const message = ({ ts, text, reactions = [] }: MessageParams): SlackMessage => ({
  ts,
  threadTs: ROOT_TS,
  userId: 'U1',
  botId: null,
  text,
  subtype: null,
  replyCount: 1,
  replyUserCount: 1,
  postedAt: '2026-08-05T09:00:00Z' as IsoDateTime,
  latestReplyAt: null,
  reactions,
});

const MESSAGES: ReadonlyArray<SlackMessage> = [
  message({ ts: ROOT_TS, text: 'billing webhook fails on retry' }),
  message({ ts: REPLY_TS, text: 'i can repro it', reactions: [{ name: 'eyes', count: 2 }] }),
];

type ActionsParams = {
  readonly reply?: SlackThreadActions['reply'];
  readonly react?: SlackThreadActions['react'];
  readonly isWriting?: boolean;
  readonly error?: string | null;
};

const buildActions = ({
  reply = vi.fn(async () => undefined),
  react = vi.fn(),
  isWriting = false,
  error = null,
}: ActionsParams): SlackThreadActions => ({ reply, react, isWriting, error });

type RenderParams = {
  readonly actions: SlackThreadActions;
};

const renderConversation = ({ actions }: RenderParams) =>
  render(
    <ThreadConversation
      messages={MESSAGES}
      users={[{ id: 'U1', name: 'ada', isBot: false, isDeleted: false, avatarUrl: null }]}
      channels={[]}
      isLoading={false}
      error={null}
      onRetry={vi.fn()}
      actions={actions}
    />,
  );

afterEach(cleanup);

describe('ThreadConversation', () => {
  it('says replies go out as plain text from the bot', () => {
    renderConversation({ actions: buildActions({}) });

    expect(screen.getByText('Sent as plain text')).toBeDefined();
    expect(screen.queryByText('Markdown supported')).toBeNull();
    expect(
      screen.getByText('Replies post to Slack as the connected bot, not as you.'),
    ).toBeDefined();
  });

  it('hands the composer text to the reply action', async () => {
    const reply = vi.fn(async () => undefined);
    renderConversation({ actions: buildActions({ reply }) });

    fireEvent.change(screen.getByLabelText('Reply in thread'), { target: { value: '  on it  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));

    await waitFor(() => {
      expect(reply).toHaveBeenCalledWith('on it');
    });
  });

  it('shows the composer error when the reply is refused', async () => {
    const reply = vi.fn(async () => {
      throw new Error('missing_scope: chat:write');
    });
    renderConversation({ actions: buildActions({ reply }) });

    fireEvent.change(screen.getByLabelText('Reply in thread'), { target: { value: 'on it' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('missing_scope: chat:write');
    });
  });

  it('reacts to the message the affordance sits on', () => {
    const react = vi.fn();
    renderConversation({ actions: buildActions({ react }) });

    const buttons = screen.getAllByRole('button', { name: 'React with :tada:' });
    fireEvent.click(buttons[1]!);

    expect(react).toHaveBeenCalledWith({ messageTs: REPLY_TS, name: 'tada' });
  });

  it('adds to a reaction already on the message', () => {
    const react = vi.fn();
    renderConversation({ actions: buildActions({ react }) });

    const pill = screen.getAllByRole('button', { name: 'React with :eyes:' })[1]!;
    expect(pill.textContent).toContain('2');
    fireEvent.click(pill);

    expect(react).toHaveBeenCalledWith({ messageTs: REPLY_TS, name: 'eyes' });
  });

  it('disables the reaction affordance with a reason while a write runs', () => {
    renderConversation({ actions: buildActions({ isWriting: true }) });

    const button = screen.getAllByRole('button', { name: 'React with :eyes:' })[0]!;
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('title')).toBe('Waiting for the current Slack write');
  });

  it('surfaces a reaction failure above the composer', () => {
    renderConversation({ actions: buildActions({ error: 'missing_scope: reactions:write' }) });

    expect(screen.getByRole('alert').textContent).toContain('missing_scope: reactions:write');
  });
});
