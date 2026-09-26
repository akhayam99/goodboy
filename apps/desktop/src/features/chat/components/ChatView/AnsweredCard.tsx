import { useState } from 'react';
import { Bot, CheckCircle2 } from 'lucide-react';
import { Markdown } from '@goodboy/ui';
import type { OpenQuestion } from '@goodboy/types';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';

type Props = {
  readonly question: OpenQuestion;
  readonly answeredByName?: string | null;
};

const RESOLVED_BY_AGENT = '[resolved by agent]';

const agentAnsweredLabel = ({ name }: { readonly name: string | null }): string =>
  name === null || name.trim() === '' ? 'Agent answered:' : `${name} answered for you:`;

export const AnsweredCard = ({ question, answeredByName = null }: Props) => {
  const [open, setOpen] = useState(false);
  const resolvedByAgent = question.userAnswer === RESOLVED_BY_AGENT;
  const answeredByAgent = resolvedByAgent || question.answerSource === 'agent';
  const answeredAt = question.answeredAt ?? question.createdAt;
  const tone = CONCEPT_TONE.questions;

  return (
    <TranscriptDisclosure
      tone={tone}
      open={open}
      bodyClassName="gap-4 pl-2 pr-2 pb-2"
      header={
        <TranscriptRowHeader
          grouped
          tone={tone}
          icon={
            answeredByAgent ? (
              <Bot size={ICON_SIZE.row} aria-hidden />
            ) : (
              <CheckCircle2 size={ICON_SIZE.row} aria-hidden />
            )
          }
          eyebrow="answered"
          preview={question.text}
          meta={formatRelativeAge({ fromIso: answeredAt })}
          open={open}
          onToggle={() => setOpen((value) => !value)}
        />
      }
    >
      <Markdown
        text={question.text}
        className="min-w-0 gap-2 break-words text-sm font-medium leading-relaxed text-foreground"
      />
      {resolvedByAgent ? (
        <p className="text-secondary text-muted-foreground">resolved by agent</p>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-secondary font-medium text-muted-foreground">
            {answeredByAgent ? agentAnsweredLabel({ name: answeredByName }) : 'You answered:'}
          </span>
          <Markdown
            text={question.userAnswer ?? ''}
            className="gap-2 break-words text-prose text-foreground"
          />
        </div>
      )}
    </TranscriptDisclosure>
  );
};
