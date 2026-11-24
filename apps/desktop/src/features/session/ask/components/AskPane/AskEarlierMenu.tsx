import { Listbox } from '@goodboy/ui';
import type { ListboxOption } from '@goodboy/ui';
import type { AskThread, ChatId } from '@goodboy/types';
import { useNow } from '../../../../../shared/hooks/useNow';
import { dayLabelOf } from '../../../../../shared/utils/time/dayLabelOf';

type Props = {
  readonly threads: ReadonlyArray<AskThread>;
  readonly isDisabled: boolean;
  readonly onShow: (threadId: ChatId) => void;
};

const EARLIER_CAP = 5;

const DAY_TICK_MS = 60_000;

const LABEL = 'Earlier questions';

export const AskEarlierMenu = ({ threads, isDisabled, onShow }: Props) => {
  const now = useNow(DAY_TICK_MS);
  if (threads.length === 0) {
    return null;
  }
  const options: ReadonlyArray<ListboxOption<ChatId>> = threads
    .slice(0, EARLIER_CAP)
    .map((thread) => ({
      value: thread.id,
      label: thread.title,
      meta: dayLabelOf({ at: thread.lastActivityAt, now }),
    }));
  return (
    <Listbox
      options={options}
      value={null}
      onChange={onShow}
      trigger="quiet"
      valueLabel="Earlier"
      ariaLabel={LABEL}
      noun="question"
      disabled={isDisabled}
    />
  );
};
