import type { ConnectionGroups } from './connectionGroups';

type Params = {
  readonly groups: ConnectionGroups;
  readonly workspaceName: string | null;
};

const NO_PROVIDER = 'Connect a provider to start a session';

export const connectionsSubtitle = ({ groups, workspaceName }: Params): string => {
  const { providers, tools } = groups;
  if (providers.total > 0 && providers.readyCount === 0) {
    return NO_PROVIDER;
  }
  const providerPart = `${providers.readyCount} of ${providers.total} providers ready`;
  if (tools === null || workspaceName === null) {
    return providerPart;
  }
  return `${providerPart} · ${tools.readyCount} of ${tools.total} integrations in ${workspaceName}`;
};
