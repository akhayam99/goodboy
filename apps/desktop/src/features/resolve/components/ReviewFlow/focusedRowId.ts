export const focusedRowId = (): string | null =>
  document.activeElement instanceof HTMLElement
    ? (document.activeElement.closest('[data-thread-id]')?.getAttribute('data-thread-id') ?? null)
    : null;
