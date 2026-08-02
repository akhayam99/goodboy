import { useEffect, useState } from 'react';
import { EmptyState } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatError } from '../../../../shared/lib/errors';
import { sanitizeBranchSlug } from '../../../../shared/utils/sanitizeBranchSlug';
import { slugifyBranch } from '../../../../shared/utils/slugifyBranch';
import { ghPrHeadBranch } from '../../../github/github';
import { LaunchSessionPanel } from '../../../integrations/components/LaunchSessionPanel';
import { goalFromIssue } from '../goal-from-issue';
import { issuePullRequests, type LinearIssue } from '../client';
import { LinearIssueDetail } from '../LinearIssueDetail';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly issue: LinearIssue | null;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

const SLUG_MAX_LEN = 48;

type Params = {
  readonly issue: LinearIssue;
};

const branchSlugFor = ({ issue }: Params): string => {
  const branchName = issue.branchName;
  if (branchName != null && branchName !== '') {
    const idx = branchName.indexOf('/');
    const tail = idx >= 0 ? branchName.slice(idx + 1) : branchName;
    const cleaned = sanitizeBranchSlug({ input: tail, maxLength: SLUG_MAX_LEN });
    if (cleaned.length > 0) {
      return cleaned;
    }
  }
  return slugifyBranch({ input: issue.title, maxLength: SLUG_MAX_LEN });
};

export const IssueDetailPanel = ({ issue, sessionId, workspaceId, onClose }: Props) => {
  const rootPath = useAppStore(
    (s) => s.workspaces.find((w) => w.id === workspaceId)?.rootPath ?? null,
  );
  const isBranchless = useAppStore(
    (s) => s.workspaces.find((w) => w.id === workspaceId)?.kind === 'simple',
  );

  const adoptablePr =
    issue != null && !isBranchless
      ? (issuePullRequests(issue).find((pr) => pr.repo != null && pr.repo !== '') ?? null)
      : null;

  const [prBranch, setPrBranch] = useState<string | null>(null);
  const [prResolving, setPrResolving] = useState(false);
  const [prError, setPrError] = useState<string | null>(null);

  useEffect(() => {
    setPrBranch(null);
    setPrError(null);
  }, [issue]);

  useEffect(() => {
    if (adoptablePr?.repo == null || rootPath == null) {
      return;
    }
    const prNumber = adoptablePr.number;
    let cancelled = false;
    setPrResolving(true);
    setPrError(null);
    ghPrHeadBranch(rootPath, prNumber, workspaceId)
      .then((branch) => {
        if (!cancelled) {
          setPrBranch(branch);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPrError(formatError(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPrResolving(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [adoptablePr?.repo, adoptablePr?.number, rootPath, workspaceId]);

  if (issue == null) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          bordered
          tone={CONCEPT_TONE.linear}
          icon={CONCEPT_ICONS.linear}
          title="No issue selected"
          description="Pick an issue to see its details and launch a session."
          size="lg"
          headingLevel={2}
        />
      </div>
    );
  }

  const launch = (
    <LaunchSessionPanel
      key={issue.id}
      workspaceId={workspaceId}
      linkedSessionId={sessionId}
      goalSeed={goalFromIssue(issue)}
      branchSlugSeed={branchSlugFor({ issue })}
      externalTask={{
        provider: 'linear',
        externalId: issue.id,
        identifier: issue.identifier,
        url: issue.url,
        title: issue.title,
      }}
      adoptable={
        adoptablePr != null
          ? {
              label: `Continue on PR #${adoptablePr.number}`,
              branch: prBranch,
              hint: `Adopts the branch of PR #${adoptablePr.number}: the existing PR links to this session instead of starting a duplicate.`,
              isResolving: prResolving,
              error: prError,
            }
          : null
      }
      onClose={onClose}
    />
  );

  return (
    <LinearIssueDetail
      key={issue.id}
      issue={issue}
      workspaceId={workspaceId}
      rail={launch}
      fit="fill"
    />
  );
};
