import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { Reveal, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ARTIFACT_GROUP_LABEL, type ArtifactListRow as Row } from '../../artifactListRows';
import type { ArtifactGroup } from '../../artifactStateOf';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ArtifactListRow } from './ArtifactListRow';

type Props = {
  readonly group: ArtifactGroup;
  readonly rows: ReadonlyArray<Row>;
  readonly sessionId: SessionId;
  readonly isOpen: boolean;
  readonly openPartsIds: ReadonlySet<string>;
  readonly onToggleGroup: (group: ArtifactGroup) => void;
  readonly onTogglePartsOf: (rowId: string) => void;
  readonly onOpenRow: (row: Row) => void;
};

export const ArtifactListGroup = ({
  group,
  rows,
  sessionId,
  isOpen,
  openPartsIds,
  onToggleGroup,
  onTogglePartsOf,
  onOpenRow,
}: Props) => {
  const panelId = useId();
  return (
    <section data-testid={`artifact-group-${group}`} className="flex min-w-0 flex-col">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => onToggleGroup(group)}
        className="flex h-7 w-fit items-center gap-1.5 rounded-md pr-1.5 pl-0.5 text-label text-muted-foreground hover:text-foreground"
      >
        <ChevronDown
          size={ICON_SIZE.control}
          aria-hidden
          className={cn('motion-safe:transition-transform', !isOpen && '-rotate-90')}
        />
        {ARTIFACT_GROUP_LABEL[group]}
        <span className="tabular-nums text-faint-foreground">{rows.length}</span>
      </button>
      <Reveal open={isOpen} id={panelId}>
        {group === 'deleted' ? (
          <p className="pr-2 pb-2 pl-7 text-label text-faint-foreground">
            Deleted artifacts stay here. Restore them, or delete them for good.
          </p>
        ) : null}
        <ul className="flex min-w-0 flex-col">
          {rows.map((row) => (
            <li key={row.id} className="min-w-0">
              <ArtifactListRow
                row={row}
                sessionId={sessionId}
                isPartsOpen={openPartsIds.has(row.id)}
                onTogglePartsOf={onTogglePartsOf}
                onOpenRow={onOpenRow}
              />
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
};
