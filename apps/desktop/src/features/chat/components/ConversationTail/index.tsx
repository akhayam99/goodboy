import { Button } from '@goodboy/ui';
import type { IsoDateTime } from '@goodboy/types';
import type { ThinkingContext } from '../../utils/thinking-context';
import { ThinkingIndicator } from '../ThinkingIndicator';

type Props = {
  readonly context: ThinkingContext;
  readonly onStop: () => void;
  readonly startedAt?: IsoDateTime | null;
};

export const ConversationTail = ({ context, onStop, startedAt = null }: Props) => (
  <div data-conversation-tail className="flex min-w-0 items-center gap-2">
    <ThinkingIndicator context={context} startedAt={startedAt} />
    <Button variant="quiet" size="xs" onClick={onStop}>
      Stop
    </Button>
  </div>
);
