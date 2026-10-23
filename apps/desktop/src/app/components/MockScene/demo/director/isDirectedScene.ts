export const isDirectedScene = (): boolean =>
  new URLSearchParams(window.location.search).has('director');
