import { invokeCommand } from '../../shared/lib/invokeCommand';

export type OtherToolId = 'claude-code' | 'codex' | 'cursor';

export type OtherToolUsage = {
  readonly id: OtherToolId;
  readonly path: string;
  readonly displayPath: string;
  readonly bytes: number;
  readonly sessions: number;
  readonly goodboyBytes: number;
};

export type OtherToolsScan =
  | { readonly status: 'ready'; readonly tools: ReadonlyArray<OtherToolUsage> }
  | { readonly status: 'cancelled' };

type ScanParams = {
  readonly codexThreadIds: ReadonlyArray<string>;
  readonly cursorChatIds: ReadonlyArray<string>;
};

export const scanOtherTools = ({
  codexThreadIds,
  cursorChatIds,
}: ScanParams): Promise<OtherToolsScan> =>
  invokeCommand<OtherToolsScan>('other_tools_scan', {
    request: { codexThreadIds, cursorChatIds },
  });

export const cancelOtherToolsScan = (): Promise<void> => invokeCommand<void>('other_tools_cancel');
