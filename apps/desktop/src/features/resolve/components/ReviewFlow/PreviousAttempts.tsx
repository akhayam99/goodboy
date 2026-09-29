import { useState } from 'react';
import { Collapsible } from '@goodboy/ui';
import { modelLabel } from '../../../chat/utils/chat-constants';
import type { PreviousAttempt } from '../../attemptHistory';
import { FAILED_RUN_COPY } from '../../failedRunCopy';

type Props = {
  readonly attempts: ReadonlyArray<PreviousAttempt>;
};

const capitalized = ({ text }: { readonly text: string }): string =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

const attemptLine = ({ attempt }: { readonly attempt: PreviousAttempt }): string =>
  [
    `Attempt ${attempt.number}`,
    modelLabel(attempt.model),
    attempt.effort === null ? null : capitalized({ text: attempt.effort }),
    attempt.outcome,
  ]
    .flatMap((part) => (part === null ? [] : [part]))
    .join(' · ');

export const PreviousAttempts = ({ attempts }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [first] = attempts;
  if (first === undefined) {
    return null;
  }
  const summary =
    attempts.length === 1 ? attemptLine({ attempt: first }) : `${attempts.length} earlier attempts`;
  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      trigger={<span className="text-secondary text-muted-foreground">{summary}</span>}
    >
      <ul aria-label={FAILED_RUN_COPY.attemptsRegion} className="flex min-w-0 flex-col gap-2">
        {attempts.map((attempt) => (
          <li key={attempt.id} className="flex min-w-0 list-none flex-col gap-0.5 text-secondary">
            {attempts.length > 1 && (
              <span className="text-foreground">{attemptLine({ attempt })}</span>
            )}
            <span className="text-muted-foreground">
              {attempt.reason ?? `Attempt ${attempt.number} finished`}
            </span>
          </li>
        ))}
      </ul>
    </Collapsible>
  );
};
