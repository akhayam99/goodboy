import { IntegrationConnectPanel } from '../../components/IntegrationConnectPanel';

type Props = {
  readonly compact?: boolean;
  readonly wrapped?: boolean;
};

export const MissingGithubRemoteEmptyState = ({ compact = false, wrapped = true }: Props) => {
  const panel = (
    <IntegrationConnectPanel
      provider="github"
      description="This project isn't on GitHub yet. Publish it from the project's git pill to review pull requests and issues here."
      headingLevel={compact ? undefined : 2}
    >
      <p className="text-meta text-muted-foreground">
        Publishing creates the repository and pushes main. Nothing else is sent.
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
