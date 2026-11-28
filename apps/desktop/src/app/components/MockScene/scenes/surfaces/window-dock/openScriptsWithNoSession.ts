import { useAppStore } from '../../../../../../store';
import { WORKSPACE_ID } from '../../BoardScene';

const PROJECT_ROOTS: ReadonlyArray<readonly [string, string, string]> = [
  ['~/code/harborline/payments-api', 'dev', 'vite --port 3000'],
  ['~/code/harborline/notify-relay', 'test', 'vitest run'],
  ['~/code/harborline/ledger-core', 'build', 'tsc -b'],
];

export const openScriptsWithNoSession = (): void => {
  useAppStore.setState({
    currentWorkspaceId: WORKSPACE_ID,
    loadProjectRootScripts: async () => undefined,
    loadScriptPins: async () => undefined,
    projectRootScripts: Object.fromEntries(
      PROJECT_ROOTS.map(([rootPath, name, body]) => [
        rootPath,
        {
          status: 'ready' as const,
          error: null,
          groups: [
            {
              source: 'package-json' as const,
              packageName: name,
              relDir: '',
              manager: 'pnpm',
              scripts: [{ name, body, command: `pnpm run ${name}` }],
            },
          ],
        },
      ]),
    ),
  });
  useAppStore.getState().openDrawer({ kind: 'scripts', sessionId: null, payload: null });
};
