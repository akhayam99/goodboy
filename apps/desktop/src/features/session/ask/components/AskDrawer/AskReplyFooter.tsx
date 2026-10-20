import { FactCard } from '@goodboy/ui';
import type { ChatMessage } from '@goodboy/types';
import { askReplyDetail } from '../../askReplyDetail';
import { askReplyFooter } from '../../askReplyFooter';

type Props = {
  readonly message: ChatMessage;
  readonly costUsd: number | null;
};

export const AskReplyFooter = ({ message, costUsd }: Props) => {
  const facts = askReplyDetail({ readCount: message.reads.length, costUsd });
  const footer = (
    <p data-testid="ask-footer" className="w-fit text-meta text-faint-foreground">
      {askReplyFooter({ message })}
    </p>
  );
  if (facts.length === 0) {
    return footer;
  }
  return <FactCard card={{ title: 'Answer', facts }}>{footer}</FactCard>;
};
