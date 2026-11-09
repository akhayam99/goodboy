import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { askAboutSession } from '../../session/ask/askAboutSession';
import { askInChat } from '../../workspace-chat/askInChat';
import type { PaletteEntry } from '../types';

const ASK_SESSION_KEY = 'ask:session';

const ASK_IN_CHAT_KEY = 'ask:chat';

export const ASK_KEYS: ReadonlySet<string> = new Set([ASK_SESSION_KEY, ASK_IN_CHAT_KEY]);

const ASK_SESSION_LABEL = 'Ask about this session';

const ASK_IN_CHAT_LABEL = 'Ask in chat';

type Params = {
  readonly query: string;
  readonly sessionId: SessionId | null;
  readonly leading: ReadonlyArray<PaletteEntry>;
  readonly hasWorkspace: boolean;
};

export const askEntries = ({
  query,
  sessionId,
  leading,
  hasWorkspace,
}: Params): ReadonlyArray<PaletteEntry> => {
  if (!hasWorkspace) {
    return leading;
  }
  const question = query.trim();
  const chat: PaletteEntry = {
    key: ASK_IN_CHAT_KEY,
    label: ASK_IN_CHAT_LABEL,
    kind: 'action',
    group: null,
    icon: CONCEPT_ICONS.chat,
    detail: `"${question}"`,
    run: () => void askInChat({ question }),
  };
  if (sessionId === null) {
    return [...leading, chat];
  }
  return [
    ...leading,
    {
      key: ASK_SESSION_KEY,
      label: ASK_SESSION_LABEL,
      kind: 'action',
      group: null,
      icon: CONCEPT_ICONS.ask,
      detail: `"${question}"`,
      run: () => askAboutSession({ sessionId, question }),
    },
    chat,
  ];
};
