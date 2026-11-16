import type { Workspace } from '@goodboy/types';
import type { ConnectionsFocus } from '../../connectionsFocus';
import { openConnection } from '../../openConnection';
import { ConnectionsIndex } from '../ConnectionsIndex';
import { IntegrationDetail } from '../IntegrationDetail';
import { ProviderDetail } from '../ProviderDetail';

type Props = {
  readonly currentWorkspace: Workspace | null;
  readonly focus: ConnectionsFocus | null;
};

export const ConnectionsFocusView = ({ currentWorkspace, focus }: Props) => {
  if (focus === null) {
    return <ConnectionsIndex workspace={currentWorkspace} />;
  }
  if (focus.kind === 'provider') {
    return (
      <ProviderDetail
        key={focus.provider}
        focus={focus}
        workspaceId={currentWorkspace?.id ?? null}
      />
    );
  }
  if (currentWorkspace === null) {
    return <ConnectionsIndex workspace={null} />;
  }
  return (
    <IntegrationDetail
      key={focus.tool}
      workspaceId={currentWorkspace.id}
      workspaceName={currentWorkspace.name}
      tool={focus.tool}
      onUp={() => openConnection({ focus: null, isUp: true })}
    />
  );
};
