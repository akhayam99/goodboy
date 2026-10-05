import { EmptyLine, PageColumn } from '@goodboy/ui';
import type { PrCheckRun, PullRequestState } from '@goodboy/types';
import { openUrl } from '../../../shared/lib/editor';
import { ChecksMode } from '../../review/components/ReviewPane/modes/ChecksMode';

type Props = {
  readonly pr: PullRequestState | null;
  readonly checks: ReadonlyArray<PrCheckRun>;
};

export const BranchChecks = ({ pr, checks }: Props) => (
  <PageColumn width="full">
    {pr === null ? (
      <EmptyLine>No pull request yet, so no checks.</EmptyLine>
    ) : (
      <ChecksMode checks={checks} fallbackUrl={pr.url} onOpenUrl={(url) => void openUrl(url)} />
    )}
  </PageColumn>
);
