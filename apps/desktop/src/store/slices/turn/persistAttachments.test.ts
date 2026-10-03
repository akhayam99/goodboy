// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';

const { written } = vi.hoisted(() => ({
  written: [] as Array<{ readonly worktreeDir: string; readonly fileName: string }>,
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../features/chat/turn', async () => ({
  ...(await import('../../storyHarness')).turnModuleMock(),
  writeAttachment: async (args: {
    readonly worktreeDir: string;
    readonly attachmentId: string;
    readonly fileName: string;
  }) => {
    written.push({ worktreeDir: args.worktreeDir, fileName: args.fileName });
    return `.goodboy/attachments/${args.attachmentId}-${args.fileName}`;
  },
}));

import { STORE_IMPORT_TIMEOUT_MS, importStore, type StoryStore } from '../../storyHarness';
import { persistAttachments } from './persistAttachments';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const PROJECT_ROOT = '/Users/mara/code/cascadia';
const SCRATCH = '/tmp/goodboy/scratch/session-1';

const input = {
  id: 'att-1',
  fileName: 'checkout-502.png',
  mimeType: 'image/png',
  dataBase64: 'QUJD',
};

const run = (attachmentDir?: string) =>
  persistAttachments(useAppStore.getState, {
    attachmentInputs: [input],
    workingDir: PROJECT_ROOT,
    ...(attachmentDir !== undefined && { attachmentDir }),
    activeAgentId: 'agent-1' as AgentId,
    sessionId: 'session-1' as SessionId,
    resolvedPrompt: 'Why the 502?',
    now: () => '2026-10-03T09:00:00.000Z' as IsoDateTime,
  });

describe('persistAttachments', () => {
  it('writes into the working folder and names the file relative to it', async () => {
    written.length = 0;
    const result = await run();
    expect(written).toEqual([{ worktreeDir: PROJECT_ROOT, fileName: 'checkout-502.png' }]);
    expect(result.ok && result.resolvedPrompt).toContain(
      '.goodboy/attachments/att-1-checkout-502.png',
    );
    expect(result.ok && result.resolvedPrompt).not.toContain(SCRATCH);
  });

  it('keeps a first lap file out of the project folder and gives the agent its full path', async () => {
    written.length = 0;
    const result = await run(SCRATCH);
    expect(written).toEqual([{ worktreeDir: SCRATCH, fileName: 'checkout-502.png' }]);
    expect(result.ok && result.resolvedPrompt).toContain(
      `${SCRATCH}/.goodboy/attachments/att-1-checkout-502.png`,
    );
    expect(result.ok && result.attachmentRefs.map((ref) => ref.relPath)).toEqual([
      '.goodboy/attachments/att-1-checkout-502.png',
    ]);
  });
});
