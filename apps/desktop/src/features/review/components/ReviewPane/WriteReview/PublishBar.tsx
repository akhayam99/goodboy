import { useState } from 'react';
import { ChevronDown, MessageSquare } from 'lucide-react';
import { AnchoredPopover, Button, SegmentedTabs, Textarea, useDropdown } from '@goodboy/ui';
import type { ReviewablePrProvider, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectOpenDrawer } from '../../../../../store/slices/drawer/selectOpenDrawer';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import type { PublishPrReviewVerdict } from '../../../../../store/slices/review-drafts/types';

type Props = {
  readonly sessionId: SessionId;
  readonly provider: ReviewablePrProvider;
  readonly draftCount: number;
  readonly publishing: boolean;
  readonly onPublish: (opts: { verdict: PublishPrReviewVerdict; body: string }) => void;
};

const VERDICTS = [
  { value: 'comment', label: 'Comment' },
  { value: 'approve', label: 'Approve' },
  { value: 'request_changes', label: 'Request changes' },
] as const;

export const PublishBar = ({ sessionId, provider, draftCount, publishing, onPublish }: Props) => {
  const [verdict, setVerdict] = useState<PublishPrReviewVerdict>('comment');
  const [body, setBody] = useState('');
  const toggleDrawer = useAppStore((s) => s.toggleDrawer);
  const isDrawerOpen = useAppStore((s) => selectOpenDrawer(s)?.kind === 'review-drafts');
  const submit = useDropdown({
    align: 'end',
    width: 'w-96 max-w-[calc(100vw-2rem)]',
    expectedHeight: 260,
    expectedWidth: 384,
  });
  const canPublish = !publishing && (draftCount > 0 || body.trim() !== '');
  const draftWord = draftCount === 1 ? 'draft' : 'drafts';

  return (
    <div data-slot="review-dock" className="flex min-w-0 items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={isDrawerOpen}
        onClick={() => toggleDrawer({ kind: 'review-drafts', sessionId, payload: {} })}
      >
        <MessageSquare size={ICON_SIZE.row} aria-hidden />
        {draftCount} {draftWord}
      </Button>
      <AnchoredPopover
        dropdown={submit}
        role="dialog"
        ariaLabel="Submit review"
        anchorClassName="ml-auto"
        className="p-3"
        trigger={
          <Button
            size="sm"
            onClick={submit.toggle}
            aria-haspopup="dialog"
            aria-expanded={submit.open}
            disabled={publishing}
          >
            {publishing ? 'Submitting…' : 'Submit review'}
            <ChevronDown size={ICON_SIZE.row} aria-hidden />
          </Button>
        }
      >
        <div className="flex flex-col gap-2.5">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Review summary (optional)"
            aria-label="Review summary"
            autoGrow
            minRows={3}
            maxRows={8}
            disabled={publishing}
            className="text-body"
          />
          {provider === 'github' ? (
            <SegmentedTabs<PublishPrReviewVerdict>
              options={VERDICTS}
              value={verdict}
              onChange={setVerdict}
              size="sm"
              ariaLabel="Review verdict"
            />
          ) : (
            <p className="text-secondary text-muted-foreground">
              Comments post as merge request discussions; the summary posts as a note.
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-secondary tabular-nums text-muted-foreground">
              {draftCount} {draftWord} will post
            </span>
            <Button
              size="sm"
              disabled={!canPublish}
              onClick={() => {
                onPublish({ verdict: provider === 'gitlab' ? 'comment' : verdict, body });
                submit.close();
              }}
            >
              Submit
            </Button>
          </div>
        </div>
      </AnchoredPopover>
    </div>
  );
};
