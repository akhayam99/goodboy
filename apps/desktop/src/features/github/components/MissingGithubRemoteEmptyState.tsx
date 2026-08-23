import { IntegrationConnectPanel } from '../../integrations/components/IntegrationConnectPanel';

type Props = {
  readonly compact?: boolean;
  readonly wrapped?: boolean;
};

export const MissingGithubRemoteEmptyState = ({ compact = false, wrapped = true }: Props) => {
  const panel = (
    <IntegrationConnectPanel
      provider="github"
      description="This repository does not have a GitHub remote. Add one with Git before reviewing pull requests and issues here."
      headingLevel={compact ? undefined : 2}
    >
      <p className="text-xs leading-relaxed text-muted-foreground">
        Goodboy does not change repository remotes from this screen.
      </p>
    </IntegrationConnectPanel>
  );

  if (!wrapped) {
    return panel;
  }

  return (
    <div className={compact ? 'flex justify-center py-5' : 'flex justify-center'}>{panel}</div>
  );
};
