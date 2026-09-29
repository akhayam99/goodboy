import type { ChatSummary } from '@goodboy/types';
import { isChatIdle } from '../../store/slices/chats/isChatIdle';
import { formatClock } from '../../shared/utils/time/formatClock';
import { formatWeekday } from '../../shared/utils/time/formatWeekday';

const DAY_MS = 24 * 60 * 60 * 1000;

type Params = {
  readonly chat: Pick<ChatSummary, 'lastActivityAt' | 'pinnedAt'>;
  readonly now: number;
};

const startOfDay = ({ now }: Pick<Params, 'now'>): number => {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};

export const chatRowTime = ({ chat, now }: Params): string => {
  const at = Date.parse(chat.lastActivityAt);
  if (Number.isNaN(at)) {
    return '';
  }
  if (isChatIdle({ chat, now })) {
    return `idle ${Math.floor((now - at) / DAY_MS)}d`;
  }
  if (at >= startOfDay({ now })) {
    return formatClock({ at });
  }
  return formatWeekday({ at, isShort: true });
};
