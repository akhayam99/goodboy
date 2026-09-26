export const PERMISSIONS_SECTION_ID = 'permissions';

export const openPermissionSettings = () => {
  window.dispatchEvent(
    new CustomEvent('goodboy:open-settings', {
      detail: { scope: 'workspace', section: PERMISSIONS_SECTION_ID },
    }),
  );
};
