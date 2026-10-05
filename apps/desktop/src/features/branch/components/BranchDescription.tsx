import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { PageColumn, ScrollFade, cn } from '@goodboy/ui';
import type { PrDetail, PullRequestState, SessionId } from '@goodboy/types';
import type { LensKind } from '../../../store';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import {
  PR_EDIT_DETAILS_EVENT,
  PR_REQUEST_REVIEW_EVENT,
  pullRequestEventName,
} from '../../actions/kinds/pullRequest';
import { PrDetailsMode } from '../../review/components/ReviewPane/modes/PrDetailsMode';

type Props = {
  readonly sessionId: SessionId;
  readonly pr: PullRequestState;
  readonly detail: PrDetail | null;
  readonly canEdit: boolean;
  readonly canRequestReview: boolean;
  readonly onSelectLens: (lens: LensKind) => void;
  readonly onMutated: () => void;
};

export const BranchDescription = ({
  sessionId,
  pr,
  detail,
  canEdit,
  canRequestReview,
  onSelectLens,
  onMutated,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const open = (): void => setIsOpen(true);
    const names = [PR_EDIT_DETAILS_EVENT, PR_REQUEST_REVIEW_EVENT].map((name) =>
      pullRequestEventName({ name, sessionId }),
    );
    for (const name of names) {
      window.addEventListener(name, open);
    }
    return () => {
      for (const name of names) {
        window.removeEventListener(name, open);
      }
    };
  }, [sessionId]);

  return (
    <PageColumn className="flex min-w-0 flex-col gap-2 pb-2">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex w-fit items-center gap-1 rounded-sm text-meta text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <ChevronRight
          size={ICON_SIZE.row}
          aria-hidden
          className={cn('motion-safe:transition-transform', isOpen && 'rotate-90')}
        />
        Description
      </button>
      <div hidden={!isOpen}>
        <ScrollFade className="max-h-[50vh]" viewportClassName="pb-2">
          <PrDetailsMode
            sessionId={sessionId}
            pr={pr}
            detail={detail}
            canEdit={canEdit}
            canRequestReview={canRequestReview}
            onSelectLens={onSelectLens}
            onMutated={onMutated}
          />
        </ScrollFade>
      </div>
    </PageColumn>
  );
};
