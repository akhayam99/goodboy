import type { ProviderDisplayInfo } from '../../../../../features/providers/providers';
import type { DirectorStore } from './directorTypes';
import { installArtifactComments } from './installArtifactComments';
import { installDiffNotes } from './installDiffNotes';

type Params = {
  readonly store: DirectorStore;
};

const PROVIDERS: ReadonlyArray<ProviderDisplayInfo> = (
  [
    ['anthropic', 'claude', 'Claude', '2.1.300'],
    ['codex', 'codex', 'Codex', '0.165.0'],
  ] as const
).map(([id, binary, label, version]) => ({
  id,
  binary,
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
  connection: 'connected',
  version,
  identity: 'harborline',
  label,
  error: null,
  docsUrl: 'https://example.invalid/docs',
}));

export const installDemoWorld = ({ store }: Params): void => {
  installArtifactComments({ store });
  installDiffNotes({ store });
  if (store.getState().providers.some((provider) => provider.connection === 'connected')) {
    return;
  }
  store.setState({ providers: PROVIDERS });
};
