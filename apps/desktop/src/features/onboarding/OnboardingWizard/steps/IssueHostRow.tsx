import { Button } from '@goodboy/ui';
import type { CodeHost } from '../hostFromRemote';
import { IntegrationChoiceRow } from './IntegrationChoiceRow';

export type IssueHost = Extract<CodeHost, 'github' | 'gitlab'>;

export const IssueHostRow = ({
  issueHost,
  preferredHost,
  onBackToCodeHost,
}: {
  readonly issueHost: IssueHost | null;
  readonly preferredHost: CodeHost | null;
  readonly onBackToCodeHost: (() => void) | null;
}) => {
  if (issueHost !== null) {
    const label = issueHost === 'github' ? 'GitHub' : 'GitLab';
    return (
      <IntegrationChoiceRow
        provider={issueHost}
        label={`${label} Issues`}
        line={`Comes with ${label}.`}
        isReady
        isExpanded={false}
        onExpandedChange={() => undefined}
      />
    );
  }
  if (onBackToCodeHost === null) {
    return null;
  }
  const provider = preferredHost === 'gitlab' ? 'gitlab' : 'github';
  const label = provider === 'gitlab' ? 'GitLab' : 'GitHub';
  return (
    <IntegrationChoiceRow
      provider={provider}
      label={`${label} Issues`}
      line={`Needs ${label}, which you skipped.`}
      isReady={false}
      isExpanded={false}
      onExpandedChange={() => undefined}
      blockedAction={
        <Button size="sm" variant="ghost" onClick={onBackToCodeHost}>
          Back to Code host
        </Button>
      }
    />
  );
};
