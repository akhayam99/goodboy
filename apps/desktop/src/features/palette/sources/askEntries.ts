import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { PaletteEntry } from '../types';

const ASK_SESSION_KEY = 'ask:session';

const ASK_IN_CHAT_KEY = 'ask:chat';

export const ASK_KEYS: ReadonlySet<string> = new Set([ASK_SESSION_KEY, ASK_IN_CHAT_KEY]);

const ASK_SESSION_LABEL = 'Ask about this session';

const ASK_IN_CHAT_LABEL = 'Ask in Chat';

type Params = {
  readonly query: string;
  readonly sessionId: SessionId | null;
  readonly askSession: (params: {
    readonly sessionId: SessionId;
    readonly question: string;
  }) => void;
  readonly askChat: (question: string) => void;
};

export const askEntries = ({
  query,
  sessionId,
  askSession,
  askChat,
}: Params): ReadonlyArray<PaletteEntry> => {
  const question = query.trim();
  const chat: PaletteEntry = {
    key: ASK_IN_CHAT_KEY,
    label: ASK_IN_CHAT_LABEL,
    kind: 'action',
    group: null,
    icon: CONCEPT_ICONS.chat,
    detail: `"${question}"`,
    run: () => askChat(question),
  };
  if (sessionId === null) {
    return [chat];
  }
  return [
    {
      key: ASK_SESSION_KEY,
      label: ASK_SESSION_LABEL,
      kind: 'action',
      group: null,
      icon: CONCEPT_ICONS.ask,
      detail: `"${question}"`,
      run: () => askSession({ sessionId, question }),
    },
    chat,
  ];
};
