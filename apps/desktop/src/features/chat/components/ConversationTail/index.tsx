import { Button } from '@goodboy/ui';
import type { ThinkingContext } from '../../utils/thinking-context';
import { ThinkingIndicator } from '../ThinkingIndicator';

type Props = {
  readonly context: ThinkingContext;
  readonly onStop: () => void;
};

export const ConversationTail = ({ context, onStop }: Props) => (
  <div data-conversation-tail className="flex min-w-0 items-center gap-2">
    <ThinkingIndicator context={context} />
    <Button variant="quiet" size="xs" onClick={onStop}>
      Stop
    </Button>
  </div>
);
