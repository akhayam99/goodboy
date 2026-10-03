// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type {
  ChatMessage,
  ChatMessageId,
  ChatId,
  IsoDateTime,
  ProjectId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import type { AppStore } from '../../store/store';
import { createMemoryChatBackend } from './createMemoryChatBackend';
import { startWorkFromChat } from './startWorkFromChat';
import { summarizeChatForWork } from './summarizeChatForWork';
import type { WorkBrief } from './workBrief';

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
  attachments: [],
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

const BRIEF: WorkBrief = {
  title: 'Send notify-relay messages once on a failure',
  goal: 'Stop notify-relay from sending a message twice when a send fails.',
  know: ['worker.ts:52 sets maxAttempts: 2 on the job.'],
  files: ['notify-relay/src/queue/worker.ts:52'],
  projects: ['notify-relay'],
};

const CHAT = {
  title: 'Why does notify-relay retry twice?',
  provider: 'anthropic',
  model: 'sonnet-5',
} as const;

describe('turn a chat into work', () => {
  it('creates a session with the goal and no agent or kickoff', async () => {
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
      session: aSession({ id: 'session-new' as SessionId }),
    }));
    const setSessionConfig = vi.fn<AppStore['setSessionConfig']>();

    const started = await startWorkFromChat({
      workspaceId: WORKSPACE_ID,
      brief,
      target: { kind: 'new', projectIds: [PROJECT_ID] },
      routing: null,
      createSession,
      setSessionConfig,
    });

    expect(started).toEqual({ sessionId: 'session-new', draft: null });
    expect(summarize).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'anthropic', model: 'sonnet-5' }),
    );
    expect(createSession).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      title: 'Send notify-relay messages once on a failure',
      goal: [
        'Stop notify-relay from sending a message twice when a send fails.',
        '',
        'What we know:',
        '- worker.ts:52 sets maxAttempts: 2 on the job.',
        '',
        'Files:',
        '- notify-relay/src/queue/worker.ts:52',
      ].join('\n'),
    });
    expect(setSessionConfig).not.toHaveBeenCalled();
  });

  it('sets the session default model and effort after creating it', async () => {
    const createSession = vi.fn(async () => ({
      session: aSession({ id: 'session-new' as SessionId }),
    }));
    const setSessionConfig = vi.fn<AppStore['setSessionConfig']>();

    await startWorkFromChat({
      workspaceId: WORKSPACE_ID,
      brief: BRIEF,
      target: { kind: 'new', projectIds: [] },
      routing: { provider: 'anthropic', model: 'opus-5-5', effort: 'high' },
      createSession,
      setSessionConfig,
    });

    expect(setSessionConfig).toHaveBeenCalledWith('session-new', {
      providerOverride: 'anthropic',
      modelOverride: 'opus-5-5',
      effort: 'high',
    });
  });

  it('hands back the brief as a draft for an existing session and creates nothing', async () => {
    const createSession = vi.fn<AppStore['createSession']>();
    const setSessionConfig = vi.fn<AppStore['setSessionConfig']>();

    const started = await startWorkFromChat({
      workspaceId: WORKSPACE_ID,
      brief: BRIEF,
      target: { kind: 'add', sessionId: 'session-205' as SessionId },
      routing: { provider: 'anthropic', model: 'opus-5-5', effort: 'high' },
      createSession,
      setSessionConfig,
    });

    expect(started.sessionId).toBe('session-205');
    expect(started.draft).toMatch(
      /^Send notify-relay messages once on a failure\n\nStop notify-relay/,
    );
    expect(createSession).not.toHaveBeenCalled();
    expect(setSessionConfig).not.toHaveBeenCalled();
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
      session: aSession({ id: 'session-new' as SessionId }),
    }));
    const start = (projectIds: ReadonlyArray<ProjectId>) =>
      startWorkFromChat({
        workspaceId: WORKSPACE_ID,
        brief,
        target: { kind: 'new', projectIds },
        routing: null,
        createSession,
        setSessionConfig: vi.fn<AppStore['setSessionConfig']>(),
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
