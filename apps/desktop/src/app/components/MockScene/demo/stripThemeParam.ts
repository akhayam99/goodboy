export const stripThemeParam = (): void => {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('theme')) {
    return;
  }
  url.searchParams.delete('theme');
  const search = url.searchParams.toString();
  const next = `${url.pathname}${search === '' ? '' : `?${search}`}${url.hash}`;
  window.history.replaceState(window.history.state, '', next);
};
