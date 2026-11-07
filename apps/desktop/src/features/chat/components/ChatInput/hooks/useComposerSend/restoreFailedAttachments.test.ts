vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import type { PendingAttachment } from '../../../../../attachments/pendingAttachment';
import { restoreFailedAttachments } from './restoreFailedAttachments';

const AGENT = brandId<AgentId>({ value: 'agent-harborline' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const pendingOf = (id: string): PendingAttachment => ({
  id,
  fileName: `${id}.png`,
  mimeType: 'image/png',
  blob: new Blob(['x']),
  relPath: `.goodboy/${id}.png`,
});

const draftOf = (id: string) => ({
  id,
  fileName: `${id}.png`,
  mimeType: 'image/png',
  relPath: `.goodboy/${id}.png`,
});

describe('restoreFailedAttachments', () => {
  it('keeps an attachment added after the send when the save fails late', () => {
    store.getState().setAgentAttachments(AGENT, [draftOf('added-later')]);
    const setAttachments = vi.fn();

    restoreFailedAttachments({ agentId: AGENT, sent: [pendingOf('sent')], setAttachments });

    expect(store.getState().agentAttachments[AGENT]?.map((item) => item.id)).toEqual([
      'sent',
      'added-later',
    ]);
  });

  it('does not duplicate an attachment already in the stored draft', () => {
    store.getState().setAgentAttachments(AGENT, [draftOf('sent'), draftOf('added-later')]);
    const setAttachments = vi.fn();

    restoreFailedAttachments({
      agentId: AGENT,
      sent: [pendingOf('sent')],
      setAttachments,
    });

    expect(store.getState().agentAttachments[AGENT]?.map((item) => item.id)).toEqual([
      'sent',
      'added-later',
    ]);
  });

  it('merges into the visible attachments of a composer that stayed mounted', () => {
    let visible: ReadonlyArray<PendingAttachment> = [pendingOf('added-later'), pendingOf('sent')];

    restoreFailedAttachments({
      agentId: AGENT,
      sent: [pendingOf('sent')],
      setAttachments: (next) => {
        visible = typeof next === 'function' ? next(visible) : next;
      },
    });

    expect(visible.map((item) => item.id)).toEqual(['sent', 'added-later']);
  });
});
