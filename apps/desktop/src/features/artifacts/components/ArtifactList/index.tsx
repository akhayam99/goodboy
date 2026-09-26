import { LensEmptyState } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { ArtifactFilter, ArtifactGeneration } from '../../artifactCollection';
import type { ArtifactListCounts, ArtifactListRow as Row } from '../../artifactListRows';
import { ARTIFACT_KIND_CONCEPT } from '../../artifactPresentation';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { ArtifactFilterTabs } from '../ArtifactStudio/ArtifactFilterTabs';
import { ArtifactListRow } from './ArtifactListRow';
import { ArtifactNewMenu } from './ArtifactNewMenu';

type Props = {
  readonly sessionId: SessionId;
  readonly rows: ReadonlyArray<Row>;
  readonly counts: ArtifactListCounts;
  readonly filter: ArtifactFilter;
  readonly onFilterChange: (filter: ArtifactFilter) => void;
  readonly onOpen: (row: Row) => void;
  readonly onStop: (generation: ArtifactGeneration) => void;
  readonly onRetry: (generation: ArtifactGeneration) => void;
};

const EMPTY_COPY: Record<ArtifactFilter, { readonly title: string; readonly description: string }> =
  {
    all: {
      title: 'No artifacts yet',
      description:
        'Plans, reports and wireframes made in this session collect here. Agents write plans as they work. Start a report or a wireframe with New.',
    },
    plan: {
      title: 'No plans yet',
      description: 'Plans appear here once an agent drafts one.',
    },
    report: {
      title: 'No reports yet',
      description: 'A report writes up what this session has done so far.',
    },
    wireframe: {
      title: 'No wireframes yet',
      description: 'A wireframe draws the screens and the flow you describe.',
    },
  };

export const ArtifactList = ({
  sessionId,
  rows,
  counts,
  filter,
  onFilterChange,
  onOpen,
  onStop,
  onRetry,
}: Props) => {
  const empty = EMPTY_COPY[filter];
  const concept = filter === 'all' ? 'artifacts' : ARTIFACT_KIND_CONCEPT[filter];

  return (
    <PaneShell
      header={
        <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="min-w-0 truncate text-title text-foreground">Artifacts</h1>
            {counts.all > 0 ? (
              <span className="shrink-0 text-secondary tabular-nums text-muted-foreground">
                {counts.all}
              </span>
            ) : null}
          </div>
          <ArtifactFilterTabs value={filter} counts={counts} onChange={onFilterChange} />
          <div className="ml-auto flex shrink-0 items-center">
            <ArtifactNewMenu sessionId={sessionId} />
          </div>
        </div>
      }
    >
      {rows.length === 0 ? (
        <LensEmptyState
          tone={CONCEPT_TONE[concept]}
          icon={CONCEPT_ICONS[concept]}
          title={empty.title}
          description={empty.description}
        />
      ) : (
        <ul data-testid="artifact-list" className="flex min-w-0 flex-col">
          {rows.map((row) => (
            <li key={row.key} className="min-w-0">
              <ArtifactListRow
                row={row}
                onOpen={() => onOpen(row)}
                onStop={() => {
                  if (row.target.kind === 'generation') {
                    onStop(row.target.generation);
                  }
                }}
                onRetry={() => {
                  if (row.target.kind === 'generation') {
                    onRetry(row.target.generation);
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </PaneShell>
  );
};
