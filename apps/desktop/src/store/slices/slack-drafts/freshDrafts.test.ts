// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type IntegrationDraft,
  type IntegrationDraftId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';

const { announceDataChanged, decideSlackDraft, loadPendingSlackDraftsForSession } = vi.hoisted(
  () => ({
    announceDataChanged: vi.fn(async (_params: unknown) => undefined),
    decideSlackDraft: vi.fn(),
    loadPendingSlackDraftsForSession: vi.fn(),
  }),
);

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../features/integrations/slack/drafts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../features/integrations/slack/drafts')>()),
  decideSlackDraft,
  loadPendingSlackDraftsForSession,
}));
vi.mock('../../../shared/lib/dataChanged', () => ({
  announceDataChanged,
  listenDataChanged: vi.fn(async () => () => undefined),
}));

import { answerSlackReply } from '../../../features/companion/actions/answerSlackReply';
import { clearPosted } from '../../../features/companion/actions/postedSlackDrafts';
import { parseDecideAction } from '../../../features/companion/actions/parseDecideAction';
import { slackDraftVersionOf } from '../../../features/companion/actions/versions';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const sessionId = brandId<SessionId>({ value: 'ses-ledger-core' });
const workspaceId = brandId<WorkspaceId>({ value: 'ws-harborline' });

const draftOf = (id: string): IntegrationDraft => ({
  id: brandId<IntegrationDraftId>({ value: id }),
  workspaceId,
  sessionId,
  provider: 'slack',
  verb: 'reply',
  target: { channelId: 'C-harborline', threadTs: '1700000000.000100' },
  body: 'Shipping the fix to payments-api today.',
  status: 'pending',
  createdAt: '2026-11-25T10:00:00.000Z',
  updatedAt: '2026-11-25T10:00:00.000Z',
  decidedAt: null,
});

const announced = (): ReadonlyArray<unknown> =>
  announceDataChanged.mock.calls.map((call) => Reflect.get(Object(call[0]), 'change'));

const SLACK_DRAFT_CHANGE = { kind: 'slack-draft', sessionId };

const deferred = <Value>() => {
  let resolve: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.clearAllMocks();
  loadPendingSlackDraftsForSession.mockReset();
  loadPendingSlackDraftsForSession.mockResolvedValue([]);
  clearPosted();
});

const idsOf = (): ReadonlyArray<string> =>
  (useAppStore.getState().sessionSlackDrafts[sessionId] ?? []).map((draft) => draft.id);

describe('loadSessionSlackDrafts, two loads that overlap', () => {
  it('keeps the newer list when the older request settles last', async () => {
    const older = deferred<ReadonlyArray<IntegrationDraft>>();
    loadPendingSlackDraftsForSession.mockReturnValueOnce(older.promise);
    loadPendingSlackDraftsForSession.mockResolvedValueOnce([draftOf('new')]);
    const load = useAppStore.getState().loadSessionSlackDrafts;

    const first = load(sessionId);
    await load(sessionId);
    older.resolve([draftOf('old')]);
    await first;

    expect(idsOf()).toEqual(['new']);
  });
});

describe('deciding a draft', () => {
  const decide = () =>
    useAppStore
      .getState()
      .decideSessionSlackDraft({ sessionId, draftId: draftOf('d1').id, status: 'sent' });

  it('keeps a draft that arrived while the write ran, and announces after it (state changed since)', async () => {
    useAppStore.setState({ sessionSlackDrafts: { [sessionId]: [draftOf('d1')] } });
    decideSlackDraft.mockImplementationOnce(async () => {
      expect(announced()).toEqual([]);
      useAppStore.setState({ sessionSlackDrafts: { [sessionId]: [draftOf('d1'), draftOf('d3')] } });
      return true;
    });
    loadPendingSlackDraftsForSession.mockResolvedValueOnce([draftOf('d3')]);

    await decide();

    expect(idsOf()).toEqual(['d3']);
    expect(announced()).toEqual([SLACK_DRAFT_CHANGE]);
  });

  it('is not undone by a load that started before the decision', async () => {
    const older = deferred<ReadonlyArray<IntegrationDraft>>();
    useAppStore.setState({ sessionSlackDrafts: { [sessionId]: [draftOf('d1')] } });
    loadPendingSlackDraftsForSession.mockReturnValueOnce(older.promise);
    decideSlackDraft.mockResolvedValueOnce(true);
    const load = useAppStore.getState().loadSessionSlackDrafts(sessionId);

    await decide();
    older.resolve([draftOf('d1')]);
    await load;

    expect(idsOf()).toEqual([]);
  });

  it('keeps the draft and announces nothing when the write fails (outcome uncertain)', async () => {
    useAppStore.setState({ sessionSlackDrafts: { [sessionId]: [draftOf('d1')] } });
    decideSlackDraft.mockRejectedValueOnce(new Error('database is locked'));

    await expect(decide()).rejects.toThrow('database is locked');

    expect(idsOf()).toEqual(['d1']);
    expect(announced()).toEqual([]);
  });
});

describe('answering a draft from the phone', () => {
  const answerOf = ({ draft }: { readonly draft: IntegrationDraft }) => {
    const action = parseDecideAction({
      raw: {
        kind: 'answerSlackReply',
        actionId: 'phone-action-1',
        workspaceId,
        sessionId,
        verdict: 'send',
        draftId: draft.id,
        seenVersion: slackDraftVersionOf({ draft }),
        text: draft.body,
      },
    });
    if (action === null || action.kind !== 'answerSlackReply') {
      throw new Error('test action did not parse');
    }
    return action;
  };

  const runAnswer = (draft: IntegrationDraft) =>
    answerSlackReply({
      action: answerOf({ draft }),
      getStore: useAppStore.getState,
      ports: { approvePlan: vi.fn(), setTreeCap: vi.fn() },
    });

  it('tells the other windows once the draft is sent', async () => {
    const draft = draftOf('d1');
    const replyToSlackThread = vi.fn(async () => undefined);
    useAppStore.setState({ sessionSlackDrafts: { [sessionId]: [draft] }, replyToSlackThread });
    decideSlackDraft.mockResolvedValueOnce(true);

    const result = await runAnswer(draft);

    expect(result.kind).toBe('done');
    expect(replyToSlackThread).toHaveBeenCalledOnce();
    expect(announced()).toEqual([SLACK_DRAFT_CHANGE]);
    expect(idsOf()).toEqual([]);
  });

  it('posts once and announces on the retry when the first save failed (part succeeded)', async () => {
    const draft = draftOf('d1');
    const replyToSlackThread = vi.fn(async () => undefined);
    useAppStore.setState({ sessionSlackDrafts: { [sessionId]: [draft] }, replyToSlackThread });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    decideSlackDraft.mockRejectedValueOnce(new Error('database is locked'));
    decideSlackDraft.mockResolvedValueOnce(true);

    const first = await runAnswer(draft);
    errorSpy.mockRestore();
    expect(first.kind).toBe('failed');
    expect(announced()).toEqual([]);
    expect(idsOf()).toEqual(['d1']);

    const second = await runAnswer(draft);
    expect(second.kind).toBe('done');
    expect(replyToSlackThread).toHaveBeenCalledOnce();
    expect(announced()).toEqual([SLACK_DRAFT_CHANGE]);
  });
});
