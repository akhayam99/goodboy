import type { WorkspaceId } from '@goodboy/types';
import { Band, BandRow, Button } from '@goodboy/ui';
import { openSettings } from '../../../settings/openSettings';
import { usePolicySummary } from '../../hooks/usePolicySummary';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const RulesProvidersBand = ({ workspaceId }: Props) => {
  const summary = usePolicySummary({ workspaceId });
  return (
    <Band label="Providers" ariaLabel="Providers" headingLevel={3}>
      <BandRow>
        <span className="min-w-0 shrink-0 text-row text-foreground">When a provider is out</span>
        <span
          data-testid="rules-policy-summary"
          className="min-w-0 flex-1 truncate text-meta text-muted-foreground"
        >
          {summary}
        </span>
        <Button variant="ghost" size="sm" onClick={() => openSettings({ scope: 'providers' })}>
          Open Providers & models
        </Button>
      </BandRow>
    </Band>
  );
};
