import type { ChatId } from '@goodboy/types';
import type { AppStore } from '../../store';

type Params = {
  readonly state: Pick<AppStore, 'appStudio'>;
  readonly chatId: ChatId;
};

export const isViewingChat = ({ state, chatId }: Params): boolean =>
  state.appStudio?.kind === 'chat' && state.appStudio.chatId === chatId;
