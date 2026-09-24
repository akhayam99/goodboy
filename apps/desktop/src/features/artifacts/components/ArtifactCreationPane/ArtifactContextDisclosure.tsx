import { Collapsible, Eyebrow } from '@goodboy/ui';
import { countCutRows, type ArtifactContextInventoryRow } from '../../artifactContextInventory';
import { ArtifactContextRow } from './ArtifactContextRow';

type Props = {
  readonly rows: ReadonlyArray<ArtifactContextInventoryRow>;
  readonly truncations: ReadonlyArray<string>;
  readonly isCollecting: boolean;
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

const triggerSummary = ({
  rows,
  isCollecting,
}: {
  readonly rows: ReadonlyArray<ArtifactContextInventoryRow>;
  readonly isCollecting: boolean;
}): string => {
  if (isCollecting) {
    return 'collecting…';
  }
  const cut = countCutRows({ rows });
  const sections = `${rows.length} sections`;
  return cut === 0 ? sections : `${sections}, ${cut} cut short`;
};

export const ArtifactContextDisclosure = ({
  rows,
  truncations,
  isCollecting,
  isOpen,
  onOpenChange,
}: Props) => (
  <Collapsible
    open={isOpen}
    onOpenChange={onOpenChange}
    trigger={
      <span className="flex min-w-0 items-baseline gap-2">
        <Eyebrow label="Included context" />
        <span className="text-2xs text-faint-foreground" data-testid="artifact-context-summary">
          {triggerSummary({ rows, isCollecting })}
        </span>
      </span>
    }
  >
    <div className="flex min-w-0 flex-col gap-3 px-2 pb-2">
      <ul className="flex min-w-0 flex-col gap-2">
        {rows.map((row) => (
          <ArtifactContextRow key={row.id} row={row} />
        ))}
      </ul>
      {truncations.length === 0 ? null : (
        <div className="flex min-w-0 flex-col gap-0.5">
          <Eyebrow label="Cut short" />
          {truncations.map((note) => (
            <span key={note} className="text-2xs leading-relaxed text-faint-foreground">
              {note}
            </span>
          ))}
        </div>
      )}
      <span className="text-2xs text-faint-foreground">
        collected when this pane opened. Generate collects again.
      </span>
    </div>
  </Collapsible>
);
