export const requestNewSession = () => {
  window.dispatchEvent(new CustomEvent('goodboy:new-session'));
};
