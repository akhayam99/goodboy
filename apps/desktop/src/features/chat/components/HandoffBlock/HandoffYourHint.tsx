import { Eyebrow } from '@goodboy/ui';
import type { AgentHandoff } from '@goodboy/types';
import { hintOfMessage } from '../../utils/hintOfMessage';

type Props = {
  readonly handoff: AgentHandoff;
};

export const HandoffYourHint = ({ handoff }: Props) => {
  const hint = hintOfMessage({ message: handoff.sentMessage });
  if (hint === null) {
    return null;
  }
  return (
    <div data-testid="handoff-your-hint" className="flex min-w-0 flex-col gap-1">
      <Eyebrow label="Your hint" />
      <blockquote className="min-w-0 whitespace-pre-wrap break-words text-meta text-muted-foreground">
        {hint}
      </blockquote>
    </div>
  );
};
