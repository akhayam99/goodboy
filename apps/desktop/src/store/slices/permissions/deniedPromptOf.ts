import type { OpenPermissionAsk } from '../../../features/permissions/openPermissionAsksOf';
import { denialNoticeOf } from './denialNoticeOf';

type Params = {
  readonly asks: ReadonlyArray<OpenPermissionAsk>;
  readonly content: string;
};

export const deniedPromptOf = ({ asks, content }: Params): string => {
  if (asks.length === 0) {
    return content;
  }
  const toolName = [...new Set(asks.map((ask) => ask.toolName))].join(' and ');
  return denialNoticeOf({ toolName, reason: content.trim() });
};
