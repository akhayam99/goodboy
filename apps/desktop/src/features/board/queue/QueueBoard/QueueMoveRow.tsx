import { InteractiveRow, TruncatedText } from '@goodboy/ui';
import type { QueueMove } from '../needsYouOf';

type Props = {
  readonly move: QueueMove;
  readonly kicker: string;
  readonly onFocus: () => void;
};

export const QueueMoveRow = ({ move, kicker, onFocus }: Props) => (
  <InteractiveRow
    label={move.title}
    isSelected={false}
    onOpen={onFocus}
    dataAttributes={{ 'data-queue-move': move.id }}
    className="flex min-h-8 min-w-0 flex-col justify-center px-3 py-1"
  >
    <TruncatedText className="min-w-0 text-ui text-foreground">{move.title}</TruncatedText>
    <TruncatedText className="min-w-0 text-meta text-muted-foreground">{kicker}</TruncatedText>
  </InteractiveRow>
);
