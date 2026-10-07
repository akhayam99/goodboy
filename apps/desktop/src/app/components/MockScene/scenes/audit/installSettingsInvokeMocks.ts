import { mockSceneIpc } from '../mockSceneIpc';

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

export const installSettingsInvokeMocks = (): void => {
  mockSceneIpc((command) => {
    if (command === 'permission_rule_list' || command === 'permission_audit_list') {
      return [];
    }
    if (command === 'config_export_preview') {
      return { counts: EXPORT_COUNTS, leftOutFindings: [] };
    }
    return undefined;
  });
};
