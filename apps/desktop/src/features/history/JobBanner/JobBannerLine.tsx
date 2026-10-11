import { useState } from 'react';
import { ScrollFade } from '@goodboy/ui';
import type { RebaseJob } from '../rebaseJob';

type Props = {
  readonly job: RebaseJob;
};

const DETAILS_WORD = 'Details';

const OUTPUT_ID = 'rebase-job-output';

const DETAIL_LIMIT = 4000;

export const JobBannerLine = ({ job }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const { detail, line } = job;
  const at = line.indexOf(DETAILS_WORD);
  const hasLink = detail !== null && at >= 0;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p aria-live="polite" className="text-meta text-muted-foreground">
        {hasLink ? (
          <>
            {line.slice(0, at)}
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={OUTPUT_ID}
              onClick={() => setIsOpen((isShown) => !isShown)}
              className="rounded-sm text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
            >
              {DETAILS_WORD}
            </button>
            {line.slice(at + DETAILS_WORD.length)}
          </>
        ) : (
          line
        )}
      </p>
      {hasLink && isOpen ? (
        <div id={OUTPUT_ID} className="rounded-md bg-background">
          <ScrollFade className="max-h-40" fadeFrom="background">
            <pre className="whitespace-pre-wrap break-words px-3 py-2 text-code text-muted-foreground">
              {detail.slice(0, DETAIL_LIMIT)}
            </pre>
          </ScrollFade>
        </div>
      ) : null}
    </div>
  );
};
