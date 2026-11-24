import { Button } from '@goodboy/ui';

type Props = {
  readonly question: string;
  readonly onShow: () => void;
};

export const AskFoldedTurn = ({ question, onShow }: Props) => (
  <div data-testid="ask-folded-turn" className="flex min-w-0 items-center gap-2">
    <p className="min-w-0 flex-1 truncate text-prose text-muted-foreground">{question}</p>
    <Button
      variant="quiet"
      size="xs"
      aria-label={`Show the answer to ${question}`}
      onClick={onShow}
    >
      Show answer
    </Button>
  </div>
);
