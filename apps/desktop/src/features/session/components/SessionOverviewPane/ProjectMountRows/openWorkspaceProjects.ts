export const openWorkspaceProjects = (): void => {
  window.dispatchEvent(
    new CustomEvent('goodboy:open-settings', {
      detail: { scope: 'workspace', section: 'projects' },
    }),
  );
};
