import type { WireframeDocument } from '@goodboy/core';
import { CONTACT_SHEET_PLATE_WIDTH, type WireframePalette } from '../../wireframePalette';
import { WireframeSheetFrame } from './WireframeSheetFrame';

type Props = {
  readonly document: WireframeDocument;
  readonly palette: WireframePalette;
  readonly isLowFidelity: boolean;
};

export const WireframeContactSheet = ({ document, palette, isLowFidelity }: Props) => (
  <section
    data-testid="wireframe-contact-sheet"
    aria-label="Screens"
    className="print-screens flex min-w-0 flex-col gap-3"
  >
    <div className="flex items-baseline gap-2">
      <h3 className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        Screens
      </h3>
      <span className="tabular-nums text-2xs text-muted-foreground">{document.screens.length}</span>
    </div>
    <ol className="print-frames flex flex-wrap items-start gap-6">
      {document.screens.map((screen, index) => (
        <li
          key={screen.id}
          data-testid="wireframe-sheet-item"
          className="print-frame flex flex-col gap-1.5"
        >
          <div
            className="flex min-w-0 items-baseline gap-2"
            style={{ width: CONTACT_SHEET_PLATE_WIDTH[screen.viewport] }}
          >
            <span className="shrink-0 tabular-nums text-2xs text-muted-foreground">
              {index + 1}
            </span>
            <span className="truncate text-2xs font-medium text-foreground">{screen.title}</span>
            <span className="shrink-0 text-2xs text-muted-foreground">{screen.viewport}</span>
          </div>
          <WireframeSheetFrame screen={screen} palette={palette} isLowFidelity={isLowFidelity} />
          {screen.note === undefined ? null : (
            <span
              className="text-2xs italic text-muted-foreground"
              style={{ width: CONTACT_SHEET_PLATE_WIDTH[screen.viewport] }}
            >
              {screen.note}
            </span>
          )}
        </li>
      ))}
    </ol>
  </section>
);
