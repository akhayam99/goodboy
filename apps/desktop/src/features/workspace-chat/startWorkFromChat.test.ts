import { describe, expect, it, vi } from 'vitest';
import type {
  ChatMessage,
  ChatMessageId,
  ChatId,
  IsoDateTime,
  ProjectId,
  Session,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { createMemoryChatBackend } from './createMemoryChatBackend';
import { startWorkFromChat } from './startWorkFromChat';
import { summarizeChatForWork } from './summarizeChatForWork';

const WORKSPACE_ID = 'ws-harborline' as WorkspaceId;
const PROJECT_ID = 'project-notify-relay' as ProjectId;
const AT = '2026-09-28T10:00:00.000Z' as IsoDateTime;
const PROJECTS = ['payments-api', 'notify-relay', 'ledger-core'];

const FAKE_SUMMARY = JSON.stringify({
  title: 'Send notify-relay messages once on a failure',
  goal: 'Stop notify-relay from sending a message twice when a send fails.',
  know: ['worker.ts:52 sets maxAttempts: 2 on the job.'],
  files: ['notify-relay/src/queue/worker.ts:52'],
  projects: ['notify-relay'],
});

type MessageSeed = Pick<ChatMessage, 'role' | 'content'>;

const messageOf = ({ role, content }: MessageSeed): ChatMessage => ({
  id: `${role}-1` as ChatMessageId,
  chatId: 'chat-retry' as ChatId,
  role,
  content,
  status: 'done',
  reads: [],
  error: null,
  provider: null,
  model: null,
  effort: null,
  createdAt: AT,
  updatedAt: AT,
});

const MESSAGES: ReadonlyArray<ChatMessage> = [
  messageOf({ role: 'user', content: 'Why does notify-relay retry twice?' }),
  messageOf({
    role: 'assistant',
    content:
      '**Two layers retry the same failure.**\n\n- notify-relay/src/queue/worker.ts:52 sets `maxAttempts: 2`.',
  }),
];

const CHAT = {
  title: 'Why does notify-relay retry twice?',
  provider: 'anthropic',
  model: 'sonnet-5',
} as const;

describe('turn a chat into work', () => {
  it('starts a session born with the summarized goal and prompt', async () => {
    const summarize = vi.fn(async () => FAKE_SUMMARY);
    const backend = createMemoryChatBackend({
      respond: async () => ({ status: 'done' }),
      summarize,
    });
    const brief = await summarizeChatForWork({
      backend,
      chat: CHAT,
      messages: MESSAGES,
      projectNames: PROJECTS,
    });
    const createSession = vi.fn(async () => ({
      session: { id: 'session-new' as SessionId } as Session,
    }));
    const sendTurn = vi.fn<AppStore['sendTurn']>();

    const sessionId = await startWorkFromChat({
      workspaceId: WORKSPACE_ID,
      brief,
      target: { kind: 'new', projectIds: [PROJECT_ID] },
      createSession,
      sendTurn,
    });

    expect(sessionId).toBe('session-new');
    expect(summarize).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'anthropic', model: 'sonnet-5' }),
    );
    expect(createSession).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      title: 'Send notify-relay messages once on a failure',
      goal: 'Stop notify-relay from sending a message twice when a send fails.',
      firstAgentKind: 'generic',
      kickoffPrompt: [
        'Stop notify-relay from sending a message twice when a send fails.',
        '',
        'What we know:',
        '- worker.ts:52 sets maxAttempts: 2 on the job.',
        '',
        'Files:',
        '- notify-relay/src/queue/worker.ts:52',
      ].join('\n'),
    });
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('sends the brief into an existing session instead', async () => {
    const backend = createMemoryChatBackend({
      respond: async () => ({ status: 'done' }),
      summarize: async () => FAKE_SUMMARY,
    });
    const brief = await summarizeChatForWork({
      backend,
      chat: CHAT,
      messages: MESSAGES,
      projectNames: PROJECTS,
    });
    const sendTurn = vi.fn<AppStore['sendTurn']>();

    await startWorkFromChat({
      workspaceId: WORKSPACE_ID,
      brief,
      target: { kind: 'add', sessionId: 'session-205' as SessionId },
      createSession: vi.fn(),
      sendTurn,
    });

    expect(sendTurn).toHaveBeenCalledWith({
      sessionId: 'session-205',
      content: expect.stringMatching(
        /^Send notify-relay messages once on a failure\n\nStop notify-relay/,
      ),
    });
  });

  it('drafts the brief from the answer when the summary fails', async () => {
    const backend = createMemoryChatBackend({
      respond: async () => ({ status: 'done' }),
      summarize: async () => {
        throw new Error('provider offline');
      },
    });

    const brief = await summarizeChatForWork({
      backend,
      chat: CHAT,
      messages: MESSAGES,
      projectNames: PROJECTS,
    });

    expect(brief.title).toBe('Why does notify-relay retry twice');
    expect(brief.goal).toBe(
      'Follow up on "Why does notify-relay retry twice?". Two layers retry the same failure.',
    );
    expect(brief.files).toEqual(['notify-relay/src/queue/worker.ts:52']);
    expect(brief.projects).toEqual(['notify-relay']);
  });

  it('drafts no project when the answer names no file of a project', async () => {
    const backend = createMemoryChatBackend({
      respond: async () => ({ status: 'done' }),
      summarize: async () => '',
    });

    const brief = await summarizeChatForWork({
      backend,
      chat: CHAT,
      messages: [
        messageOf({ role: 'user', content: 'What is a good release cadence?' }),
        messageOf({ role: 'assistant', content: 'Ship small changes every week.' }),
      ],
      projectNames: PROJECTS,
    });

    expect(brief.projects).toEqual([]);
  });

  it('starts a session with no project, one project or several', async () => {
    const brief = await summarizeChatForWork({
      backend: createMemoryChatBackend({
        respond: async () => ({ status: 'done' }),
        summarize: async () => FAKE_SUMMARY,
      }),
      chat: CHAT,
      messages: MESSAGES,
      projectNames: PROJECTS,
    });
    const createSession = vi.fn<AppStore['createSession']>(async () => ({
      session: { id: 'session-new' as SessionId } as Session,
    }));
    const start = (projectIds: ReadonlyArray<ProjectId>) =>
      startWorkFromChat({
        workspaceId: WORKSPACE_ID,
        brief,
        target: { kind: 'new', projectIds },
        createSession,
        sendTurn: vi.fn<AppStore['sendTurn']>(),
      });

    await start([]);
    await start([PROJECT_ID]);
    await start([PROJECT_ID, 'project-payments-api' as ProjectId]);

    const [none, one, many] = createSession.mock.calls.map(([input]) => input);
    expect(none).not.toHaveProperty('projectId');
    expect(none).not.toHaveProperty('additionalProjectIds');
    expect(one).toMatchObject({ projectId: PROJECT_ID });
    expect(one).not.toHaveProperty('additionalProjectIds');
    expect(many).toMatchObject({
      projectId: PROJECT_ID,
      additionalProjectIds: ['project-payments-api'],
    });
  });
});
