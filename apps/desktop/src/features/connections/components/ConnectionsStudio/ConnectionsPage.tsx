import { PaneShell, ScrollFade } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import { useConnectionRows } from '../../hooks/useConnectionRows';
import { ConnectionsGroup } from './ConnectionsGroup';

type Props = {
  readonly workspaceName: string | null;
};

const PROVIDERS_PLACE = 'This Mac, every workspace';

export const ConnectionsPage = ({ workspaceName }: Props) => {
  const rows = useConnectionRows({});

  return (
    <PaneShell page="connections" scroll="body" title={NAMES.connections}>
      <ScrollFade viewportClassName="flex flex-col gap-6 pb-6">
        <ConnectionsGroup
          id="providers"
          label={NAMES.providers}
          place={PROVIDERS_PLACE}
          rows={rows.providers}
        />
        {workspaceName === null ? null : (
          <ConnectionsGroup
            id="tools"
            label="Integrations"
            place={`${workspaceName} workspace`}
            rows={rows.tools}
          />
        )}
      </ScrollFade>
    </PaneShell>
  );
};
