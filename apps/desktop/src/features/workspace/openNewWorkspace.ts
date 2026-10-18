export const openNewWorkspace = (): void => {
  window.dispatchEvent(new CustomEvent('goodboy:add-workspace'));
};
