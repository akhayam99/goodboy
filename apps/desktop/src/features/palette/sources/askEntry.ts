import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { PaletteEntry } from '../types';

export const ASK_IN_CHAT_KEY = 'ask:chat';

const ASK_IN_CHAT_LABEL = 'Ask in Chat';

type Params = {
  readonly query: string;
  readonly ask: (question: string) => void;
};

export const askEntry = ({ query, ask }: Params): PaletteEntry => ({
  key: ASK_IN_CHAT_KEY,
  label: ASK_IN_CHAT_LABEL,
  kind: 'action',
  group: null,
  icon: CONCEPT_ICONS.chat,
  detail: `"${query.trim()}"`,
  run: () => ask(query.trim()),
});
