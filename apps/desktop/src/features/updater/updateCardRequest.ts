export const TOGGLE_UPDATE_CARD_EVENT = 'goodboy:toggle-update-card';

export const toggleUpdateCard = (): void => {
  window.dispatchEvent(new CustomEvent(TOGGLE_UPDATE_CARD_EVENT));
};
