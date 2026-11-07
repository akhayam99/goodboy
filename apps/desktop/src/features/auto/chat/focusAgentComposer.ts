export const focusAgentComposer = (): void => {
  document
    .querySelector<HTMLTextAreaElement>('[data-composer-field] textarea')
    ?.focus({ preventScroll: true });
};
