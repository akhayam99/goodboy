import { ArrowRight } from 'lucide-react';
import type { DiffComment, PrComment } from '@goodboy/types';
import { CommentSnippet } from '../CommentSnippet';
import type { ResolverOrigin } from '../../resolver-origin';
import { diffCommentLocation } from '../../diff-comment-location';
import { prCommentLocation } from '../../pr-comment-location';
import { ResolverPanelSection } from './ResolverPanelSection';

export type ResolverCommentLink = {
  readonly key: string;
  readonly label: string;
  readonly onOpen: () => void;
};

type Props = {
  readonly origin: ResolverOrigin;
  readonly threadComment: PrComment | null;
  readonly diffComment: DiffComment | null;
  readonly links: ReadonlyArray<ResolverCommentLink>;
};

const LINK_CLASS =
  'inline-flex items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-2xs font-medium text-muted-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground';

export const ResolverCommentSection = ({ origin, threadComment, diffComment, links }: Props) => (
  <ResolverPanelSection label="Comment">
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-foreground/80">
        {origin.label}
      </span>
      {!origin.isRecorded && (
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
    ) : null}
    {links.length > 0 && (
      <div className="flex flex-col items-start gap-1">
        {links.map((link) => (
          <button key={link.key} type="button" onClick={link.onOpen} className={LINK_CLASS}>
            {link.label}
            <ArrowRight size={11} aria-hidden className="opacity-70" />
          </button>
        ))}
      </div>
    )}
  </ResolverPanelSection>
);
