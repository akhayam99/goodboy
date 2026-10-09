import { Chip } from '@goodboy/ui';
import type { LinkedIssue } from '@goodboy/types';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';

type Props = {
  readonly issue: LinkedIssue;
  readonly onOpen: () => void;
};

export const IssueChip = ({ issue, onOpen }: Props) => (
  <Chip
    as="button"
    tone="neutral"
    shape="badge"
    kind="reference"
    onClick={onOpen}
    title={issue.title ?? `Open issue #${issue.number}`}
    ariaLabel={`Open issue #${issue.number}`}
    icon={<IntegrationGlyph provider="github" size="xs" />}
    label={<span className="tabular-nums">#{issue.number}</span>}
  />
);
