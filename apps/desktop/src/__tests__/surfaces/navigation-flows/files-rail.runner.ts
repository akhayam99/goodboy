import { bridge, type BridgeArgs } from './harness';

const FILES: ReadonlyArray<{
  readonly path: string;
  readonly before: string;
  readonly after: string;
}> = [
  {
    path: 'src/ledger/postCredit.ts',
    before: 'export const postCredit = 1;',
    after: 'export const postCredit = 2;',
  },
  {
    path: 'src/webhooks/applyWebhook.ts',
    before: 'export const applyWebhook = 1;',
    after: 'export const applyWebhook = 2;',
  },
  {
    path: 'src/webhooks/seenEvents.ts',
    before: 'export const seenEvents = 1;',
    after: 'export const seenEvents = 2;',
  },
  {
    path: 'test/applyWebhook.test.ts',
    before: 'export const applyWebhookTest = 1;',
    after: 'export const applyWebhookTest = 2;',
  },
];

export const RAIL_FILE_PATHS: ReadonlyArray<string> = FILES.map((file) => file.path);

const PATCH = `${FILES.map((file) =>
  [
    `diff --git a/${file.path} b/${file.path}`,
    'index 1111111..2222222 100644',
    `--- a/${file.path}`,
    `+++ b/${file.path}`,
    '@@ -1,1 +1,1 @@',
    `-${file.before}`,
    `+${file.after}`,
  ].join('\n'),
).join('\n')}\n`;

export const filesRailBridge = (command: string, args?: BridgeArgs): Promise<unknown> =>
  command === 'worktree_diff' ? Promise.resolve(PATCH) : bridge(command, args);
