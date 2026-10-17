import { R4ChatListScene } from './r4ChatListScene';

export const U25_R4_CHATLIST_SCENES = {
  'r4-chatlist-states': () => <R4ChatListScene isSelecting={false} />,
  'r4-chatlist-selecting': () => <R4ChatListScene isSelecting />,
};
