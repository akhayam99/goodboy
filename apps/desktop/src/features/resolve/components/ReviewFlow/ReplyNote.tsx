import { Check } from 'lucide-react';
import { Button, WorkNode } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openUrl } from '../../../../shared/lib/editor';
import { REPLY_NOTE_COPY, decidedNote } from '../../reviewFlowCopy';

export type ReplyNoteKind = 'bundled' | 'alone' | 'posting' | 'posted';

type Props = {
  readonly kind: ReplyNoteKind;
  readonly provider: string;
  readonly url: string | null;
  readonly isRetry: boolean;
  readonly isBusy: boolean;
  readonly onPostNow: () => void;
};

const NOTE_CLASS =
  'flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-subtle px-4 py-2 text-meta text-muted-foreground';

export const ReplyNote = ({ kind, provider, url, isRetry, isBusy, onPostNow }: Props) => {
  if (kind === 'posting') {
    return (
      <p role="status" className={NOTE_CLASS}>
        <WorkNode state="running" label={REPLY_NOTE_COPY.posting} mark={{ kind: 'dot' }} />
        {REPLY_NOTE_COPY.posting}
      </p>
    );
  }
  if (kind === 'posted') {
    return (
      <p role="status" className={NOTE_CLASS}>
        <Check size={ICON_SIZE.control} aria-hidden className="shrink-0 text-success" />
        <span className="min-w-0">{REPLY_NOTE_COPY.posted({ provider })}</span>
        {url !== null && (
          <button
            type="button"
            onClick={() => void openUrl(url)}
            className="rounded-sm text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {REPLY_NOTE_COPY.viewComment}
          </button>
        )}
      </p>
    );
  }
  return (
    <p className={NOTE_CLASS}>
      <Check size={ICON_SIZE.control} aria-hidden className="shrink-0 text-success" />
      <span className="min-w-0 flex-1">
        {kind === 'bundled'
          ? decidedNote({ state: 'replied', sha: null, provider })
          : REPLY_NOTE_COPY.alone}
      </span>
      <Button size="sm" variant="ghost" isBusy={isBusy} onClick={onPostNow}>
        {isRetry ? REPLY_NOTE_COPY.retry : REPLY_NOTE_COPY.postNow}
      </Button>
    </p>
  );
};
