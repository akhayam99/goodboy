import { Check, ExternalLink } from 'lucide-react';
import { Button, Markdown, WorkNode } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openUrl } from '../../../../shared/lib/editor';
import { BAR_COPY } from '../../commentStateCopy';
import { REPLY_NOTE_COPY, decidedNote } from '../../reviewFlowCopy';

export type ReplyNoteKind = 'bundled' | 'alone' | 'posting' | 'posted';

type Props = {
  readonly kind: ReplyNoteKind;
  readonly provider: string;
  readonly url: string | null;
  readonly reply?: string;
  readonly isRetry: boolean;
  readonly isBusy: boolean;
  readonly onPostNow: () => void;
};

const NOTE_CLASS =
  'flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-subtle px-4 py-2 text-meta text-muted-foreground';

export const ReplyNote = ({
  kind,
  provider,
  url,
  reply = '',
  isRetry,
  isBusy,
  onPostNow,
}: Props) => {
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
      <div role="status" className="flex min-w-0 flex-col gap-2 rounded-lg bg-subtle px-4 py-2">
        <p className="flex min-w-0 flex-wrap items-center gap-2 text-meta text-muted-foreground">
          <Check size={ICON_SIZE.control} aria-hidden className="shrink-0 text-success" />
          <span className="min-w-0">{REPLY_NOTE_COPY.posted({ provider })}</span>
          {url !== null && (
            <Button size="xs" variant="ghost" onClick={() => void openUrl(url)}>
              <ExternalLink size={ICON_SIZE.control} aria-hidden />
              {BAR_COPY.viewOn({ host: provider })}
            </Button>
          )}
        </p>
        {reply.trim() === '' ? null : (
          <Markdown text={reply} variant="preview" className="text-body text-foreground" />
        )}
      </div>
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
