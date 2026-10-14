export const focusAgentComposer = (): void => {
  document
    .querySelector<HTMLTextAreaElement>('[data-drop-composer] textarea')
    ?.focus({ preventScroll: true });
};
