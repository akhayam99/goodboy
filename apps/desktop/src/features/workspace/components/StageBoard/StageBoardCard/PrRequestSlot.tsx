import { CloudOff } from 'lucide-react';
import { cn, Skeleton, Tooltip } from '@goodboy/ui';
import type { SessionPrFetchState } from '@goodboy/types';
import { PullRequestChip, pullRequestMeta } from '../../../../github/components/PullRequestChip';
import type { LinkedRequest } from './getLinkedRequest';

const CHECKING_LABEL = 'Checking GitHub for a pull request';
const UNREACHABLE_LABEL = 'Could not reach GitHub, will retry';

const SLOT_CLASS = '-ml-0.5 mt-px inline-flex size-5 shrink-0 items-center justify-center';

type Props = {
  readonly linkedRequest: LinkedRequest;
  readonly isGitlab: boolean;
  readonly prFetchState: SessionPrFetchState;
  readonly onOpen: (event: React.MouseEvent) => void;
};

export const PrRequestSlot = ({ linkedRequest, isGitlab, prFetchState, onOpen }: Props) => {
  if (linkedRequest.state !== 'none') {
    const meta = pullRequestMeta({ state: linkedRequest.state });
    const numberSuffix =
      linkedRequest.number === undefined
        ? ''
        : `${isGitlab ? ' · !' : ' · #'}${linkedRequest.number}`;
    const label = linkedRequest.title ?? meta.label + numberSuffix;
    const tooltip = label + (isGitlab ? ', open in GitLab' : ', open in GitHub');
    return (
      <Tooltip content={tooltip} side="top">
        <button
          type="button"
          aria-label={tooltip}
          onClick={onOpen}
          className={cn(SLOT_CLASS, 'rounded-md transition-colors hover:bg-muted')}
        >
          <PullRequestChip
            state={linkedRequest.state}
            variant="icon"
            number={linkedRequest.number}
            iconSize={14}
            title={linkedRequest.title}
          />
        </button>
      </Tooltip>
    );
  }

  if (prFetchState === 'unknown') {
    return (
      <Tooltip content={CHECKING_LABEL} side="top">
        <span role="status" aria-label={CHECKING_LABEL} className={SLOT_CLASS}>
          <Skeleton className="size-3.5 rounded-full" />
        </span>
      </Tooltip>
    );
  }

  if (prFetchState === 'unreachable') {
    return (
      <Tooltip content={UNREACHABLE_LABEL} side="top">
        <span aria-label={UNREACHABLE_LABEL} className={cn(SLOT_CLASS, 'text-muted-foreground/50')}>
          <CloudOff size={14} aria-hidden />
        </span>
      </Tooltip>
    );
  }

  return null;
};
