import { createPortal } from 'react-dom';

const ROWS = ['Reload', 'Copy address', 'Open in your browser'];

export const BrowserCoverMenu = () =>
  createPortal(
    <div
      role="menu"
      aria-label="Page actions"
      className="fixed right-6 top-32 z-dropdown flex w-56 flex-col gap-1 rounded-lg border border-border-soft bg-background p-1"
    >
      {ROWS.map((row) => (
        <span key={row} role="menuitem" className="rounded-md px-3 py-2 text-row text-foreground">
          {row}
        </span>
      ))}
    </div>,
    document.body,
  );
