import { Button, Tooltip } from '@goodboy/ui';

type Props = {
  readonly word: string;
  readonly reason: string;
};

export const LeadStepChange = ({ word, reason }: Props) => (
  <Tooltip content={reason}>
    <Button
      variant="quiet"
      size="xs"
      aria-label={`Why the Lead ${word === 'Added' ? 'added' : 'moved'} this step`}
      className="w-fit px-0 underline decoration-faint-foreground decoration-dotted underline-offset-4"
    >
      {word}
    </Button>
  </Tooltip>
);
