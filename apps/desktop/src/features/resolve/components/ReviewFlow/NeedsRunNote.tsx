import type { ReactNode } from 'react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { FAILED_RUN_COPY } from '../../failedRunCopy';
import { NEEDS_RUN_COPY } from '../../needsRunCopy';

type Props = {
  readonly sentence: string | null;
  readonly found: string;
  readonly menu: ReactNode;
  readonly canOpenTranscript: boolean;
  readonly onOpenTranscript: () => void;
};

const RunIcon = CONCEPT_ICONS.runs;

export const NeedsRunNote = ({
  sentence,
  found,
  menu,
  canOpenTranscript,
  onOpenTranscript,
}: Props) => (
  <section
    aria-label={NEEDS_RUN_COPY.found}
    data-needs-run=""
    className="flex min-w-0 flex-col gap-2 rounded-lg bg-subtle px-4 py-2 text-meta text-foreground"
  >
    <div className="flex min-w-0 items-center gap-2">
      <RunIcon size={ICON_SIZE.control} aria-hidden className="shrink-0 text-warning" />
      <p className="min-w-0 flex-1">{sentence}</p>
      {menu}
    </div>
    <p className="min-w-0 pl-6 text-muted-foreground">{found}</p>
    {canOpenTranscript && (
      <div className="flex min-w-0 pl-4">
        <Button size="sm" variant="ghost" onClick={onOpenTranscript}>
          {FAILED_RUN_COPY.openTranscript}
        </Button>
      </div>
    )}
  </section>
);
