import { openSettings } from '../../../../settings/openSettings';
export const openWorkspaceProjects = (): void => {
  openSettings({ scope: 'workspace', section: 'projects' });
};
