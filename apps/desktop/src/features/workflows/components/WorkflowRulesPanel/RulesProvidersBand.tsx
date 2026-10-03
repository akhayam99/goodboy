import type { WorkspaceId } from '@goodboy/types';
import { Band, BandRow, Button } from '@goodboy/ui';
import { useRulesProviders } from '../../hooks/useRulesProviders';
import { openSettings } from '../../../settings/openSettings';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const RulesProvidersBand = ({ workspaceId }: Props) => {
  const policy = useRulesProviders({ workspaceId });
  return (
    <Band label="Providers" ariaLabel="Providers" headingLevel={2}>
      <BandRow>
        <span className="flex min-w-0 flex-1 flex-col">
          <span data-testid="rules-provider-summary" className="text-label text-foreground">
            {policy.summary.text}
          </span>
          <span className="text-secondary text-muted-foreground">
            Order and states are set in Defaults. Rules only summarise them.
          </span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => openSettings({ scope: 'providers' })}>
          Edit
        </Button>
      </BandRow>
    </Band>
  );
};
