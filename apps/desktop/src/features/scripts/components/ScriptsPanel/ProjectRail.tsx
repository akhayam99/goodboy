import { PANE_RHYTHM, ScrollFade, SelectableRow, StatusDot } from '@goodboy/ui';
import type { ProjectId } from '@goodboy/types';

export type ProjectRailEntry = {
  readonly id: ProjectId;
  readonly name: string;
  readonly userCount: number;
  readonly manifestCount: number;
  readonly matchCount: number;
  readonly isRunning: boolean;
};

type Props = {
  readonly entries: ReadonlyArray<ProjectRailEntry>;
  readonly selectedProjectId: ProjectId;
  readonly hasManifestScripts: boolean;
  readonly hasSearch: boolean;
  readonly onSelect: (projectId: ProjectId) => void;
};

const countLabel = ({
  entry,
  hasManifestScripts,
}: {
  readonly entry: ProjectRailEntry;
  readonly hasManifestScripts: boolean;
}): string => {
  const parts: Array<string> = [];
  if (entry.userCount > 0) {
    parts.push(`${entry.userCount} yours`);
  }
  if (hasManifestScripts && entry.manifestCount > 0) {
    parts.push(`${entry.manifestCount} manifest`);
  }
  return parts.join(' · ');
};

export const ProjectRail = ({
  entries,
  selectedProjectId,
  hasManifestScripts,
  hasSearch,
  onSelect,
}: Props) => (
  <nav aria-label="Script projects" className="flex min-h-0 w-60 shrink-0 flex-col">
    <ScrollFade className="min-h-0 flex-1">
      <div className={`flex flex-col gap-1 ${PANE_RHYTHM.rail.body}`}>
        {entries.map((entry) => {
          const selected = entry.id === selectedProjectId;
          const counts = countLabel({ entry, hasManifestScripts });
          return (
            <SelectableRow
              key={entry.id}
              selected={selected}
              ariaCurrent={selected}
              onClick={() => onSelect(entry.id)}
              className="flex-col items-stretch gap-1 px-2.5 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{entry.name}</span>
                {entry.isRunning ? (
                  <StatusDot
                    tone="info"
                    pulsing
                    size="sm"
                    ariaLabel={`Running script in ${entry.name}`}
                  />
                ) : null}
              </span>
              {counts !== '' ? (
                <span className="text-2xs text-muted-foreground/70">{counts}</span>
              ) : null}
              {hasSearch && !selected && entry.matchCount > 0 ? (
                <span className="text-2xs tabular-nums text-muted-foreground/50">
                  {entry.matchCount === 1 ? '1 match' : `${entry.matchCount} matches`}
                </span>
              ) : null}
            </SelectableRow>
          );
        })}
      </div>
    </ScrollFade>
  </nav>
);
