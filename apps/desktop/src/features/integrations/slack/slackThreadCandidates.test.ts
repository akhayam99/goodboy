import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, WorkspaceId } from '@goodboy/types';
import type { SlackChannel, SlackMessage, SlackUser } from './client';

const h = vi.hoisted(() => ({
  channels: [] as ReadonlyArray<SlackChannel>,
  users: [] as ReadonlyArray<SlackUser>,
  headsByChannel: {} as Record<string, ReadonlyArray<SlackMessage>>,
  permalinkCalls: [] as ReadonlyArray<string>,
  permalinkFails: false,
}));

vi.mock('./client', () => ({
  slackListChannels: vi.fn(async () => h.channels),
  slackListUsers: vi.fn(async () => h.users),
  slackListThreadHeads: vi.fn(async ({ channelId }: { channelId: string }) => {
    return h.headsByChannel[channelId] ?? [];
  }),
  slackGetPermalink: vi.fn(
    async ({ channelId, messageTs }: { channelId: string; messageTs: string }) => {
      h.permalinkCalls = [...h.permalinkCalls, `${channelId}:${messageTs}`];
      if (h.permalinkFails) {
        throw new Error('missing_scope');
      }
      return `https://acme.slack.com/archives/${channelId}/p${messageTs.replace('.', '')}`;
    },
  ),
}));

const { slackThreadCandidates } = await import('./slackThreadCandidates');
const { fetchIssueCandidates } = await import('../fetchIssueCandidates');
const { parseIntegrationTaskUrl } =
  await import('../../session/components/SessionWorkspace/parts/IntegrationPane/parseIntegrationTaskUrl');

const WORKSPACE_ID = 'ws-1' as WorkspaceId;

const channel = (id: string, name: string): SlackChannel => ({
  id,
  name,
  isMember: true,
  topic: null,
  memberCount: 3,
});

const head = (ts: string, text: string, latestReplyAt: string): SlackMessage => ({
  ts,
  threadTs: ts,
  userId: 'U1',
  botId: null,
  text,
  subtype: null,
  replyCount: 2,
  replyUserCount: 2,
  postedAt: latestReplyAt as IsoDateTime,
  latestReplyAt: latestReplyAt as IsoDateTime,
  reactions: [],
});

beforeEach(() => {
  h.permalinkCalls = [];
  h.permalinkFails = false;
  h.users = [{ id: 'U1', name: 'ada', isBot: false, isDeleted: false, avatarUrl: null }];
  h.channels = [channel('C1', 'eng-alerts')];
  h.headsByChannel = {
    C1: [head('1723456789.123456', 'billing webhook fails on retry', '2026-08-05T09:00:00Z')],
  };
});

describe('slackThreadCandidates', () => {
  it('builds a candidate whose external id round trips with a pasted permalink', async () => {
    const [candidate] = await slackThreadCandidates({ workspaceId: WORKSPACE_ID });

    expect(candidate?.externalId).toBe('C1:1723456789.123456');
    expect(candidate?.identifier).toBe('#eng-alerts › billing webhook fails on retry');
    expect(candidate?.title).toBe('billing webhook fails on retry');
    expect(candidate?.branchSlug).toBe('billing-webhook-fails-on-retry');
    expect(candidate?.goal).toBe(
      'Slack thread in #eng-alerts\n\nada: billing webhook fails on retry',
    );

    const pasted = parseIntegrationTaskUrl({ provider: 'slack', rawUrl: candidate?.url ?? '' });

    expect(pasted?.externalId).toBe(candidate?.externalId);
  });

  it('keeps the candidate when the permalink call fails and leaves the url empty', async () => {
    h.permalinkFails = true;

    const [candidate] = await slackThreadCandidates({ workspaceId: WORKSPACE_ID });

    expect(candidate?.externalId).toBe('C1:1723456789.123456');
    expect(candidate?.url).toBe('');
  });

  it('reads at most twelve channels and returns at most twenty-five candidates', async () => {
    h.channels = Array.from({ length: 20 }, (_, index) => channel(`C${index}`, `channel-${index}`));
    h.headsByChannel = Object.fromEntries(
      h.channels.map((entry, channelIndex) => [
        entry.id,
        Array.from({ length: 5 }, (_, headIndex) =>
          head(
            `17234567${String(channelIndex).padStart(2, '0')}.00000${headIndex}`,
            `thread ${channelIndex}-${headIndex}`,
            '2026-08-05T09:00:00Z',
          ),
        ),
      ]),
    );

    const candidates = await slackThreadCandidates({ workspaceId: WORKSPACE_ID });

    expect(candidates).toHaveLength(25);
    expect(h.permalinkCalls).toHaveLength(25);
    expect(candidates.every((candidate) => !candidate.externalId.startsWith('C12:'))).toBe(true);
  });
});

describe('fetchIssueCandidates for slack', () => {
  it('routes the slack provider to the thread candidates', async () => {
    const candidates = await fetchIssueCandidates({
      provider: 'slack',
      workspaceId: WORKSPACE_ID,
      rootPath: null,
      gitlabHost: null,
      jiraConfig: null,
    });

    expect(candidates.map((candidate) => candidate.externalId)).toEqual(['C1:1723456789.123456']);
    expect(candidates[0]?.provider).toBe('slack');
  });
});
