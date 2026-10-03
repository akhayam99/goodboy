import type { ChatId } from '@goodboy/types';
import type { ObjectTarget } from './types';

type Params = {
  readonly chatId: ChatId;
  readonly selectedIds: ReadonlyArray<ChatId>;
  readonly clearSelection: () => void;
  readonly single: ObjectTarget;
  readonly several: ObjectTarget | null;
};

export const chatSelectionTarget = ({
  chatId,
  selectedIds,
  clearSelection,
  single,
  several,
}: Params): ObjectTarget => {
  if (selectedIds.includes(chatId) && selectedIds.length > 1 && several !== null) {
    return several;
  }
  if (selectedIds.length > 0 && !selectedIds.includes(chatId)) {
    clearSelection();
  }
  return single;
};
