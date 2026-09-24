export const CHANGELOG_STUDIO_EVENT = 'goodboy:open-changelog';

export const openChangelogStudio = () => {
  window.dispatchEvent(new CustomEvent(CHANGELOG_STUDIO_EVENT));
};
