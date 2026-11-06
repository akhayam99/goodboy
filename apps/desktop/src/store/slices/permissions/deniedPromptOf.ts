import type { OpenPermissionAsk } from '../../../features/permissions/openPermissionAsksOf';
import { denialNoticeOf } from './denialNoticeOf';

type Params = {
  readonly asks: ReadonlyArray<OpenPermissionAsk>;
  readonly content: string;
  readonly prompt: string;
};

export const deniedPromptOf = ({ asks, content, prompt }: Params): string => {
  if (asks.length === 0) {
    return prompt;
  }
  const toolName = [...new Set(asks.map((ask) => ask.toolName))].join(' and ');
  const body = prompt.trim();
  if (content.trim() !== '') {
    return denialNoticeOf({ toolName, reason: body });
  }
  const notice = denialNoticeOf({ toolName, reason: '' });
  return body === '' ? notice : `${notice}\n\n${body}`;
};
