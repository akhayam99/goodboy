import { Eyebrow, SelectableRow } from '@goodboy/ui';
import type { WireframeNodeChange } from '@goodboy/core';
import { CHANGE_GLYPH, CHANGE_WORD } from './changePresentation';

type Props = {
  readonly changes: ReadonlyArray<Readonly<{ change: WireframeNodeChange; text: string }>>;
  readonly onReveal: (change: WireframeNodeChange) => void;
};

export const ChangeList = ({ changes, onReveal }: Props) => (
  <section
    aria-label="Changes on this screen"
    data-testid="wireframe-change-list"
    className="flex min-w-0 flex-col gap-2"
  >
    <h3>
      <Eyebrow label={`Changes on this screen · ${changes.length}`} />
    </h3>
    {changes.length === 0 ? (
      <p className="text-meta text-muted-foreground">Nothing changed on this screen.</p>
    ) : (
      <ul className="flex min-w-0 flex-col gap-0.5">
        {changes.map(({ change, text }) => (
          <li key={`${change.change}-${change.nodeId}`}>
            <SelectableRow
              selected={false}
              onClick={() => onReveal(change)}
              className="items-center gap-2 px-2 py-1 text-body"
            >
              <span aria-hidden className="w-4 shrink-0 text-center font-mono">
                {CHANGE_GLYPH[change.change]}
              </span>
              <span className="w-16 shrink-0 text-meta text-muted-foreground">
                {CHANGE_WORD[change.change]}
              </span>
              <span className="min-w-0 flex-1 truncate">{text}</span>
            </SelectableRow>
          </li>
        ))}
      </ul>
    )}
  </section>
);
