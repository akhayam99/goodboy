import { useState } from 'react';
import { Bot, CheckCircle2, ChevronDown } from 'lucide-react';
import { cn, Markdown } from '@goodboy/ui';
import type { OpenQuestion } from '@goodboy/types';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { MARKER_ACCENT } from '../marker-accents';
import { TranscriptShell } from '../TranscriptShell';

const successAccent = MARKER_ACCENT.success;

type Props = {
  readonly question: OpenQuestion;
};

const RESOLVED_BY_AGENT = '[resolved by agent]';

export const AnsweredCard = ({ question }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const resolvedByAgent = question.userAnswer === RESOLVED_BY_AGENT;
  const answeredAt = question.answeredAt ?? question.createdAt;

  return (
    <TranscriptShell
      tone={resolvedByAgent ? 'neutral' : 'success'}
      variant="leftBorder"
      className={cn('flex flex-col gap-1.5', resolvedByAgent && 'opacity-80')}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div className="flex min-w-0 items-start gap-2">
          {resolvedByAgent ? (
            <Bot
              size={13}
              aria-hidden
              className="shrink-0 translate-y-0.5 text-muted-foreground/60"
            />
          ) : (
            <CheckCircle2
              size={13}
              aria-hidden
              className={cn('shrink-0 translate-y-0.5', successAccent.icon)}
            />
          )}
          {expanded ? (
            <Markdown
              text={question.text}
              className="min-w-0 gap-1.5 break-words text-sm leading-relaxed text-foreground"
            />
          ) : (
            <p className="min-w-0 break-words text-xs leading-relaxed text-foreground line-clamp-1">
              {question.text}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-2xs text-muted-foreground">
          <span>{formatRelativeAge({ fromIso: answeredAt })}</span>
          <ChevronDown
            size={12}
            aria-hidden
            className={cn('transition-transform duration-150', expanded && 'rotate-180')}
          />
        </div>
      </button>

      <div className="flex flex-col gap-0.5 pl-[21px]">
        {resolvedByAgent ? (
          <p className="text-2xs italic text-muted-foreground">resolved by agent</p>
        ) : (
          <>
            <span className="text-2xs font-medium text-muted-foreground">You answered:</span>
            {expanded ? (
              <Markdown
                text={question.userAnswer ?? ''}
                className="gap-1.5 break-words text-sm leading-relaxed text-foreground"
              />
            ) : (
              <p className="line-clamp-2 break-words text-xs leading-relaxed text-foreground">
                {question.userAnswer ?? ''}
              </p>
            )}
          </>
        )}
      </div>
    </TranscriptShell>
  );
};
