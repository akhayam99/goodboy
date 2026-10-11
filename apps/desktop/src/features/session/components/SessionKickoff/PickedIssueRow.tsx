import { X } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';

type Props = {
  readonly candidate: IssueCandidate;
  readonly isBranchNamer: boolean;
  readonly onRemove: () => void;
};

export const PickedIssueRow = ({ candidate, isBranchNamer, onRemove }: Props) => (
  <li className="flex min-h-7 items-center gap-2 px-1">
    <IntegrationGlyph provider={candidate.provider} size="xs" />
    <span className="shrink-0 text-meta text-muted-foreground tabular-nums">
      {candidate.identifier}
    </span>
    <span className="min-w-0 flex-1 truncate text-body text-foreground">{candidate.title}</span>
    {isBranchNamer ? (
      <span className="shrink-0 text-meta text-faint-foreground">Names the branch</span>
    ) : null}
    <IconButton
      icon={X}
      size="xs"
      label={`Remove ${candidate.identifier}`}
      onClick={onRemove}
      className="text-muted-foreground"
    />
  </li>
);
