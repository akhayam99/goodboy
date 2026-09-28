import type { ChatSummary } from '@goodboy/types';
import { isChatIdle } from '../../store/slices/chats/isChatIdle';
import { APP_LOCALE } from '../../shared/utils/appLocale';
import { formatClockTime } from '../../shared/utils/formatClockTime';

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
    return formatClockTime({ iso: at });
  }
  return new Intl.DateTimeFormat(APP_LOCALE, { weekday: 'short' }).format(new Date(at));
};
