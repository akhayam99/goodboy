import { Button, InteractiveRow, TruncatedText } from '@goodboy/ui';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import type { QueueMove } from '../needsYouOf';

type Props = {
  readonly move: QueueMove;
  readonly kicker: string;
  readonly isFocused: boolean;
  readonly onOpen: () => void;
  readonly onNotNow: () => void;
};

const NOT_NOW = 'Not now';

export const QueueMoveRow = ({ move, kicker, isFocused, onOpen, onNotNow }: Props) => {
  const quiet = actionButtonLookOf({ verb: NOT_NOW, variant: 'ghost' });
  return (
    <InteractiveRow
      label={move.title}
      isSelected={isFocused}
      onOpen={onOpen}
      dataAttributes={{ 'data-queue-move': move.id }}
      frameClassName="group/row"
      className="flex min-h-8 min-w-0 items-center gap-3 px-3"
    >
      <TruncatedText className="min-w-0 flex-1 basis-24 text-ui text-foreground">
        {move.title}
      </TruncatedText>
      <TruncatedText className="min-w-0 max-w-[40%] shrink text-meta text-muted-foreground">
        {kicker}
      </TruncatedText>
      <span className="row-actions flex shrink-0 items-center">
        <Button
          size="xs"
          variant={quiet.variant}
          intent={quiet.intent}
          aria-label={`${NOT_NOW}: ${move.title}`}
          onClick={onNotNow}
        >
          {NOT_NOW}
        </Button>
      </span>
    </InteractiveRow>
  );
};
