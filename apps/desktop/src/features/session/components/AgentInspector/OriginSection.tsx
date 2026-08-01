import { ArrowRight } from 'lucide-react';
import type { DiffComment, PrComment } from '@goodboy/types';
import { CommentSnippet } from '../CommentSnippet';
import type { ResolverOrigin } from '../../resolver-origin';
import { diffCommentLocation } from '../../diff-comment-location';
import { prCommentLocation } from '../../pr-comment-location';
import { InspectorSection } from '../InspectorSection';

type Props = {
  readonly origin: ResolverOrigin;
  readonly threadComment: PrComment | null;
  readonly diffComment: DiffComment | null;
  readonly openLabel: string | null;
  readonly onOpen: () => void;
  readonly threadLinks?: ReadonlyArray<{ readonly threadId: string; readonly label: string }>;
  readonly onOpenThread?: (threadId: string) => void;
};

export const OriginSection = ({
  origin,
  threadComment,
  diffComment,
  openLabel,
  onOpen,
  threadLinks = [],
  onOpenThread,
}: Props) => (
  <InspectorSection question="Where it came from">
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-foreground/80">
        {origin.label}
      </span>
      {origin.isRecorded ? null : (
        <span
          title="reconstructed from the resolver's links, not recorded at spawn time"
          className="text-2xs text-muted-foreground/60"
        >
          inferred
        </span>
      )}
    </div>
    {threadComment !== null ? (
      <CommentSnippet
        author={threadComment.author}
        location={prCommentLocation({ comment: threadComment })}
        body={threadComment.body}
      />
    ) : diffComment !== null ? (
      <CommentSnippet
        location={diffCommentLocation({ comment: diffComment })}
        body={diffComment.body}
      />
    ) : (
      <p className="text-2xs italic text-muted-foreground/70">comment text is no longer cached</p>
    )}
    {openLabel !== null ? (
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-2xs font-medium text-muted-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
      >
        {openLabel}
        <ArrowRight size={11} aria-hidden className="opacity-70" />
      </button>
    ) : null}
    {threadLinks.length > 1 && onOpenThread !== undefined ? (
      <div className="flex flex-col items-start gap-1">
        {threadLinks.map((link) => (
          <button
            key={link.threadId}
            type="button"
            onClick={() => onOpenThread(link.threadId)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium text-muted-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            {link.label}
            <ArrowRight size={11} aria-hidden className="opacity-70" />
          </button>
        ))}
      </div>
    ) : null}
  </InspectorSection>
);
