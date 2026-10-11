import { Button, Input, Skeleton, SegmentedTabs } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { BranchCombobox } from '../../../worktree/BranchCombobox';
import type { LocalBranchInfo } from '../../../worktree/worktree';
import type { ClosingIssueReference } from '../../github/closingIssueReferences';
import { PropertyBlock } from '../../../../shared/components/PropertyBlock';
import { ChangelogEntry } from './ChangelogEntry';
import { ClosesChips } from './ClosesChips';
import { ReviewerChips } from './ReviewerChips';
import type { SearchReviewers } from './types';

type Props = {
  readonly sessionId: SessionId;
  readonly base: string;
  readonly branches: ReadonlyArray<LocalBranchInfo> | null;
  readonly isBasesLoading: boolean;
  readonly basesError: string | null;
  readonly onBasesRetry: () => void;
  readonly isLocked: boolean;
  readonly canSetDraft: boolean;
  readonly isDraft: boolean;
  readonly reviewers: ReadonlyArray<string>;
  readonly searchReviewers: SearchReviewers | null;
  readonly references: ReadonlyArray<ClosingIssueReference>;
  readonly changelogEntry: string | null;
  readonly onBaseChange: (value: string) => void;
  readonly onDraftChange: (value: boolean) => void;
  readonly onReviewersChange: (logins: ReadonlyArray<string>) => void;
  readonly onReferenceRemove: (reference: ClosingIssueReference) => void;
};

type OpensAs = 'ready' | 'draft';

export const ReviewSettings = ({
  sessionId,
  base,
  branches,
  isBasesLoading,
  basesError,
  onBasesRetry,
  isLocked,
  canSetDraft,
  isDraft,
  reviewers,
  searchReviewers,
  references,
  changelogEntry,
  onBaseChange,
  onDraftChange,
  onReviewersChange,
  onReferenceRemove,
}: Props) => (
  <div className="flex min-w-0 flex-col gap-4">
    <PropertyBlock label="Into">
      {branches !== null && basesError !== null ? (
        <div className="flex min-w-0 flex-col gap-2">
          <Input
            value={base}
            onChange={(event) => onBaseChange(event.target.value)}
            placeholder="main"
            aria-label="Target branch"
            disabled={isLocked}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-8 w-full text-code"
          />
          <div className="flex items-center justify-between gap-2">
            <p role="alert" className="min-w-0 truncate text-meta text-danger">
              Couldn't load branches
            </p>
            <Button variant="ghost" size="sm" disabled={isLocked} onClick={onBasesRetry}>
              Retry
            </Button>
          </div>
        </div>
      ) : branches === null ? (
        <Input
          value={base}
          onChange={(event) => onBaseChange(event.target.value)}
          placeholder="main"
          aria-label="Target branch"
          disabled={isLocked}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-8 w-full text-code"
        />
      ) : isBasesLoading ? (
        <Skeleton className="h-9 w-full rounded-md border border-border" />
      ) : (
        <BranchCombobox
          branches={branches}
          value={base}
          onChange={onBaseChange}
          disabled={isLocked}
          loading={false}
        />
      )}
    </PropertyBlock>
    {canSetDraft && (
      <PropertyBlock label="Opens as">
        <SegmentedTabs<OpensAs>
          ariaLabel="Opens as"
          size="sm"
          options={[
            { value: 'ready', label: 'Ready for review', disabled: isLocked },
            { value: 'draft', label: 'Draft', disabled: isLocked },
          ]}
          value={isDraft ? 'draft' : 'ready'}
          onChange={(value) => onDraftChange(value === 'draft')}
        />
      </PropertyBlock>
    )}
    {searchReviewers !== null && (
      <PropertyBlock label="Reviewers">
        <ReviewerChips
          sessionId={sessionId}
          logins={reviewers}
          search={searchReviewers}
          onChange={onReviewersChange}
        />
      </PropertyBlock>
    )}
    {references.length > 0 && (
      <PropertyBlock label="Closes">
        <ClosesChips references={references} onRemove={onReferenceRemove} />
      </PropertyBlock>
    )}
    {changelogEntry !== null && <ChangelogEntry entry={changelogEntry} />}
  </div>
);
