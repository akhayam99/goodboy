import type { ProjectId } from '@goodboy/types';
import type { ScriptGroup } from '../../../../../features/scripts/scripts';
import { scriptPinId } from '../../../../../features/scripts/scriptPinId';
import { scriptPinsKey } from '../../../../../features/scripts/scriptPinsKey';
import type { ProjectRootScripts } from '../../../../../store/slices/scripts/state';
import { useAppStore } from '../../../../../store';
import { SettingsFrame } from './SettingsFrame';
import { sceneParam } from './sceneParams';
import { SETTINGS_PROJECTS } from './settingsSeed';

const SECTION = sceneParam({ key: 'section' }) ?? undefined;

const script = ({ name, body }: { readonly name: string; readonly body: string }) => ({
  name,
  command: `pnpm run ${name}`,
  body,
});

const LEDGER_SCRIPTS: ScriptGroup = {
  source: 'package-json',
  packageName: 'ledger-core',
  relDir: '',
  manager: 'pnpm',
  scripts: [
    script({ name: 'dev', body: 'vite --port 4310' }),
    script({ name: 'build', body: 'tsc -b && vite build' }),
    script({ name: 'test', body: 'vitest run' }),
    script({ name: 'lint', body: 'eslint .' }),
    script({ name: 'db:migrate', body: 'node scripts/migrate.mjs' }),
  ],
};

const rootOf = (projectId: string): string =>
  SETTINGS_PROJECTS.find((project) => project.id === projectId)?.rootPath ?? '';

const ready = (groups: ReadonlyArray<ScriptGroup>): ProjectRootScripts => ({
  status: 'ready',
  groups,
  error: null,
});

const seedProjectScripts = (): void => {
  useAppStore.setState((state) => ({
    projectRootScripts: {
      [rootOf('mock-settings-ledger')]: ready([LEDGER_SCRIPTS]),
      [rootOf('mock-settings-relay')]: ready([]),
    },
    settings: {
      ...state.settings,
      [scriptPinsKey({ projectId: 'mock-settings-ledger' as ProjectId })]: JSON.stringify([
        scriptPinId({ source: 'package-json', relDir: '', name: 'dev', savedId: null }),
        scriptPinId({ source: 'package-json', relDir: '', name: 'test', savedId: null }),
      ]),
    },
    loadScriptPins: async () => undefined,
    loadProjectRootScripts: async () => undefined,
  }));
};

export const SettingsWorkspaceScene = () => (
  <SettingsFrame focus={{ scope: 'workspace', section: SECTION }} seed={seedProjectScripts} />
);
