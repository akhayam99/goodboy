export const isUserActivated = (): boolean =>
  !('userActivation' in navigator) || navigator.userActivation.isActive;
