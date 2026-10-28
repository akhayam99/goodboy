import type { ProviderDisplayInfo } from '../../../../../features/providers/providers';

export const SCENE_PROVIDERS: ReadonlyArray<ProviderDisplayInfo> = (
  [
    ['anthropic', 'claude', 'Claude'],
    ['codex', 'codex', 'Codex'],
    ['cursor', 'cursor-agent', 'Cursor'],
  ] as const
).map(([id, binary, label]) => ({
  id,
  binary,
  capabilities: { models: [] },
  connection: 'connected',
  version: '1.0.0',
  identity: 'harborline',
  label,
  error: null,
  docsUrl: 'https://example.invalid/docs',
}));
