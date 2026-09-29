import { Button, cn } from '@goodboy/ui';
import { formatClock } from '../../../../shared/utils/time/formatClock';
import { wireframeVersionAuthor, type WireframeVersion } from '../../wireframeVersion';
import { versionSummaryText } from '../../versionSummaryText';

type Props = {
  readonly version: WireframeVersion;
  readonly label: string;
  readonly agentName: string;
  readonly isCurrent: boolean;
  readonly isViewing: boolean;
  readonly onView: () => void;
  readonly onCompare: () => void;
  readonly onRestore: () => void;
};

export const VersionRow = ({
  version,
  label,
  agentName,
  isCurrent,
  isViewing,
  onView,
  onCompare,
  onRestore,
}: Props) => {
  const summary = versionSummaryText({ summary: version.summary });
  const meta = [
    wireframeVersionAuthor({ version, agentName }),
    formatClock({ at: version.createdAt }),
    ...(summary === null ? [] : [summary]),
  ].join(' · ');
  return (
    <li
      data-testid="wireframe-version-row"
      data-revision={version.revision}
      className={cn(
        'group flex min-w-0 items-start gap-2 rounded-md px-1.5 py-1',
        isViewing && 'bg-selected',
      )}
    >
      <span className="w-6 shrink-0 tabular-nums text-secondary text-muted-foreground">
        v{version.revision}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body text-foreground">{label}</span>
        <span className="truncate text-secondary text-muted-foreground">
          {isCurrent ? `Current · ${meta}` : meta}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {isViewing ? null : (
          <Button variant="ghost" size="sm" onClick={onView}>
            View
          </Button>
        )}
        {isCurrent ? null : (
          <>
            <Button variant="ghost" size="sm" onClick={onCompare}>
              Compare
            </Button>
            <Button variant="ghost" size="sm" onClick={onRestore}>
              Restore
            </Button>
          </>
        )}
      </span>
    </li>
  );
};
