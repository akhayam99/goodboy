// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  IntegrationDraft,
  IntegrationDraftId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { SlackChannel, SlackMessage, SlackUser } from '../../../integrations/slack/client';

const client = vi.hoisted(() => ({
  slackGetThread: vi.fn(),
  slackListUsers: vi.fn(),
  slackListChannels: vi.fn(),
  slackListThreadHeads: vi.fn(async () => []),
  slackPostReply: vi.fn(async () => undefined),
}));

vi.mock('../../../integrations/slack/client', () => client);

const drafts = vi.hoisted(() => ({ decideSlackDraft: vi.fn(async () => true) }));

vi.mock('../../../integrations/slack/drafts', () => drafts);

const { useAppStore } = await import('../../../../store');
const { TranscriptRows } = await import('./TranscriptRows');

const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const SESSION_ID = 's1' as SessionId;

const channels: ReadonlyArray<SlackChannel> = [{ id: 'C1', name: 'payments' }] as never;
const users: ReadonlyArray<SlackUser> = [{ id: 'U1', name: 'Robin Vale' }] as never;
const rootMessage: SlackMessage = {
  ts: '111.1',
  threadTs: null,
  userId: 'U1',
  botId: null,
  text: 'Does anyone know why the refund job skipped last night?',
  subtype: null,
  replyCount: 0,
  replyUserCount: 0,
  postedAt: null,
  latestReplyAt: null,
  reactions: [],
};

const draft: IntegrationDraft = {
  id: 'd1' as IntegrationDraftId,
  workspaceId: WORKSPACE_ID,
  sessionId: SESSION_ID,
  provider: 'slack',
  verb: 'reply',
  target: { channelId: 'C1', threadTs: '111.1' },
  body: 'The cron moved to UTC in Tuesday’s deploy.',
  status: 'pending',
  createdAt: '2026-09-26T00:00:00.000Z',
  updatedAt: '2026-09-26T00:00:00.000Z',
  decidedAt: null,
};

const renderTranscript = (slackDrafts: ReadonlyArray<IntegrationDraft>) =>
  render(
    <ul>
      <TranscriptRows
        rows={[]}
        oqByTurnOrdinal={new Map()}
        slackDrafts={slackDrafts}
        sessionId={SESSION_ID}
        selectedAgentId={'a1' as AgentId}
        workingDir={null}
        onRefreshAuth={() => undefined}
        onOpenDiff={() => undefined}
        isThinking={false}
        thinkingContext="think"
        onRetryRun={() => undefined}
        retryingRunId={null}
      />
    </ul>,
  );

beforeEach(() => {
  client.slackGetThread.mockReset().mockResolvedValue([rootMessage]);
  client.slackListUsers.mockReset().mockResolvedValue(users);
  client.slackListChannels.mockReset().mockResolvedValue(channels);
  client.slackListThreadHeads.mockClear();
  client.slackPostReply.mockClear();
  drafts.decideSlackDraft.mockClear();
  useAppStore.setState({
    slackThreads: {},
    slackUsers: {},
    slackChannels: {},
    workspaceOverrides: { [WORKSPACE_ID]: { attributionFooter: false } },
    sessionSlackDrafts: { [SESSION_ID]: [draft] },
  });
});

afterEach(cleanup);

describe('SlackDraftCard inside the transcript', () => {
  it('shows the quoted thread, the draft body, and Send, Edit, Discard', async () => {
    renderTranscript([draft]);

    expect(await screen.findByText('Reply ready for #payments')).toBeDefined();
    expect(
      await screen.findByText(
        'Robin Vale: Does anyone know why the refund job skipped last night?',
      ),
    ).toBeDefined();
    expect(screen.getByText(draft.body)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDefined();
  });

  it('sends the draft as-is and removes it from the session store', async () => {
    renderTranscript([draft]);
    await screen.findByText('Reply ready for #payments');

    await act(async () => {
      screen.getByRole('button', { name: 'Send' }).click();
    });

    await waitFor(() =>
      expect(client.slackPostReply).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        channelId: 'C1',
        threadTs: '111.1',
        text: draft.body,
      }),
    );
    expect(drafts.decideSlackDraft).toHaveBeenCalledWith({
      id: draft.id,
      status: 'sent',
      body: draft.body,
    });
    expect(useAppStore.getState().sessionSlackDrafts[SESSION_ID]).toEqual([]);
  });

  it('edits the body before sending', async () => {
    renderTranscript([draft]);
    await screen.findByText('Reply ready for #payments');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Edit reply'), {
      target: { value: 'Fixed, redeployed at 01:00 Europe/Rome.' },
    });
    await act(async () => {
      screen.getByRole('button', { name: 'Send' }).click();
    });

    await waitFor(() =>
      expect(client.slackPostReply).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Fixed, redeployed at 01:00 Europe/Rome.' }),
      ),
    );
  });

  it('discards the draft without posting to Slack', async () => {
    renderTranscript([draft]);
    await screen.findByText('Reply ready for #payments');

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() =>
      expect(drafts.decideSlackDraft).toHaveBeenCalledWith({ id: draft.id, status: 'discarded' }),
    );
    expect(client.slackPostReply).not.toHaveBeenCalled();
    expect(useAppStore.getState().sessionSlackDrafts[SESSION_ID]).toEqual([]);
  });
});
