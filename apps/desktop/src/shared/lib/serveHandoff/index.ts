import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isMainWindow } from '../../../features/workspace/window';
import { invokeCommand } from '../invokeCommand';
import { isTauriRuntime } from '../isTauriRuntime';

type HandoffRequest = {
  readonly id: string;
};

type ReplyParams<Request extends HandoffRequest, Result> = {
  readonly request: Request;
  readonly result: Result;
};

type Params<Request extends HandoffRequest, Result> = {
  readonly event: string;
  readonly command: string;
  readonly label: string;
  readonly execute: (request: Request) => Promise<Result>;
  readonly replyOf: (params: ReplyParams<Request, Result>) => Record<string, unknown>;
};

export const serveHandoff = async <Request extends HandoffRequest, Result>({
  event,
  command,
  label,
  execute,
  replyOf,
}: Params<Request, Result>): Promise<UnlistenFn> => {
  if (!isTauriRuntime() || !isMainWindow()) {
    return () => undefined;
  }
  return listen<Request>(event, (message) => {
    const request = message.payload;
    void execute(request)
      .then((result) => invokeCommand(command, replyOf({ request, result })))
      .catch((error) => console.error(`[query-bridge] ${label} result dispatch failed`, error));
  });
};
