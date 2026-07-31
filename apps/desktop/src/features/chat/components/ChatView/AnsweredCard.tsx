import { useState } from 'react';
import { Bot, CheckCircle2 } from 'lucide-react';
import { Markdown } from '@goodboy/ui';
import type { OpenQuestion } from '@goodboy/types';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { TranscriptRowHeader } from '../TranscriptRowHeader';
import { TranscriptShell } from '../TranscriptShell';

type Props = {
  readonly question: OpenQuestion;
};

const RESOLVED_BY_AGENT = '[resolved by agent]';

export const AnsweredCard = ({ question }: Props) => {
  const [open, setOpen] = useState(false);
  const resolvedByAgent = question.userAnswer === RESOLVED_BY_AGENT;
  const answeredAt = question.answeredAt ?? question.createdAt;
  const tone = resolvedByAgent ? 'neutral' : 'success';

  return (
    <div className="flex flex-col gap-0.5">
      <TranscriptRowHeader
        tone={tone}
        icon={
          resolvedByAgent ? <Bot size={12} aria-hidden /> : <CheckCircle2 size={12} aria-hidden />
        }
        eyebrow="answered"
        preview={question.text}
        meta={formatRelativeAge({ fromIso: answeredAt })}
        open={open}
        onToggle={() => setOpen((value) => !value)}
      />
      {open ? (
        <TranscriptShell
          tone={tone}
          variant="leftBorder"
          nested
          className="flex flex-col gap-2 pl-6"
        >
          <Markdown
            text={question.text}
            className="min-w-0 gap-1.5 break-words text-xs leading-relaxed text-foreground"
          />
          {resolvedByAgent ? (
            <p className="text-2xs italic text-muted-foreground">resolved by agent</p>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                You answered:
              </span>
              <Markdown
                text={question.userAnswer ?? ''}
                className="gap-1.5 break-words text-xs leading-relaxed text-foreground"
              />
            </div>
          )}
        </TranscriptShell>
      ) : null}
    </div>
  );
};
