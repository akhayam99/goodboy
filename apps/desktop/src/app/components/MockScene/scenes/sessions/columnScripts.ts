export const clickOptions = (): boolean => {
  const trigger = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Options for sessions"]',
  );
  if (trigger === null) {
    return false;
  }
  if (trigger.getAttribute('aria-expanded') !== 'true') {
    trigger.click();
  }
  return true;
};

export const hoverWebhookRow = (): boolean => {
  const row = [...document.querySelectorAll<HTMLButtonElement>('button[data-select-id]')].find(
    (candidate) => candidate.textContent?.includes('Fix webhook retries') === true,
  );
  if (row === undefined) {
    return false;
  }
  row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  return true;
};

export const holdControlTab = (): boolean => {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { code: 'Tab', key: 'Tab', ctrlKey: true, bubbles: true }),
  );
  return true;
};
