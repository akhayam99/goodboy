const ITEM_SELECTOR = '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"]';

const itemsOf = ({ container }: { readonly container: HTMLElement }): ReadonlyArray<HTMLElement> =>
  Array.from(container.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
    (item) => item.closest('[data-menu-panel]') === container.closest('[data-menu-panel]'),
  );

type MoveParams = {
  readonly container: HTMLElement;
  readonly key: 'ArrowDown' | 'ArrowUp' | 'Home' | 'End';
};

export const moveMenuFocus = ({ container, key }: MoveParams): void => {
  const items = itemsOf({ container });
  if (items.length === 0) {
    return;
  }
  const current = items.findIndex((item) => item === document.activeElement);
  const last = items.length - 1;
  const next =
    key === 'Home'
      ? 0
      : key === 'End'
        ? last
        : key === 'ArrowDown'
          ? current === -1 || current === last
            ? 0
            : current + 1
          : current <= 0
            ? last
            : current - 1;
  items[next]?.focus();
};

type TypeaheadParams = {
  readonly container: HTMLElement;
  readonly query: string;
};

export const typeaheadMenuFocus = ({ container, query }: TypeaheadParams): boolean => {
  const items = itemsOf({ container });
  const current = items.findIndex((item) => item === document.activeElement);
  const ordered = [...items.slice(current + 1), ...items.slice(0, current + 1)];
  const needle = query.toLowerCase();
  const match =
    ordered.find((item) =>
      (item.dataset.menuLabel ?? item.textContent ?? '').toLowerCase().startsWith(needle),
    ) ?? null;
  match?.focus();
  return match !== null;
};

export const focusFirstMenuItem = ({ container }: { readonly container: HTMLElement }): void => {
  itemsOf({ container })[0]?.focus();
};

export const isMenuNavigationKey = (key: string): key is MoveParams['key'] =>
  key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End';

export const isTypeaheadKey = (event: {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
}): boolean =>
  event.key.length === 1 && event.key !== ' ' && !event.metaKey && !event.ctrlKey && !event.altKey;
