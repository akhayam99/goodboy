import type { ChatSummary } from '@goodboy/types';
import { isChatIdle } from '../../store/slices/chats/isChatIdle';
import { formatAge } from '../../shared/utils/time/formatAge';

type Params = {
  readonly chat: Pick<ChatSummary, 'lastActivityAt' | 'pinnedAt'>;
  readonly now: number;
};

export const chatRowTime = ({ chat, now }: Params): string => {
  const at = Date.parse(chat.lastActivityAt);
  if (Number.isNaN(at)) {
    return '';
  }
  if (isChatIdle({ chat, now })) {
    return '';
  }
  return formatAge({ from: at, now });
};
