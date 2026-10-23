const MENU_TRIGGER = 'button[aria-label="More session actions"]';

type Params = {
  readonly label: string;
};

export const pickSessionMenuItem = ({ label }: Params): boolean => {
  const item = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (candidate) => (candidate.textContent ?? '').startsWith(label),
  );
  if (item !== undefined) {
    item.click();
    return true;
  }
  const trigger = document.querySelector<HTMLElement>(MENU_TRIGGER);
  if (trigger === null || trigger.getAttribute('aria-expanded') === 'true') {
    return false;
  }
  trigger.click();
  return false;
};
