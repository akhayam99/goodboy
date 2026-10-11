import { mockSceneIpc } from '../mockSceneIpc';
import { payloadString, payloadStrings } from './ipcPayload';

const EXPORT_COUNTS = {
  workspaces: 3,
  projects: 4,
  skills: 5,
  phaseTemplates: 6,
  permissionRules: 4,
  budgetRules: 2,
  scripts: 8,
  toolBindings: 3,
};

const PREFIX_LIST = /FROM settings WHERE substr\(key, 1, \?\) = \? ORDER BY key/;

type Seed = {
  readonly settings?: Readonly<Record<string, string>>;
};

export const installSettingsInvokeMocks = ({ settings = {} }: Seed = {}): void => {
  mockSceneIpc((command, payload) => {
    if (command === 'permission_rule_list' || command === 'permission_audit_list') {
      return [];
    }
    if (command === 'config_export_preview') {
      return { counts: EXPORT_COUNTS, leftOutFindings: [] };
    }
    if (command === 'db_select' && PREFIX_LIST.test(payloadString({ payload, key: 'sql' }) ?? '')) {
      const prefix = String(payloadStrings({ payload, key: 'params' })[0] ?? '');
      return Object.entries(settings)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({ key, value, updated_at: 0 }));
    }
    return undefined;
  });
};
