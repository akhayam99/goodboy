import type { TerminalTarget } from '../../terminalTargets';
import type { PickerCluster, PickerRow } from '../../terminalPickerClusters';
import { PickerRowView } from './PickerRowView';
import { TerminalGroupFacts } from './TerminalGroupFacts';

type Props = {
  readonly cluster: PickerCluster;
  readonly activeKey: string | null;
  readonly onPick: (target: TerminalTarget) => void;
  readonly onOpenProject: (row: PickerRow) => void;
};

export const PickerClusterView = ({ cluster, activeKey, onPick, onOpenProject }: Props) => (
  <div role="group" aria-label={cluster.title} className="flex flex-col gap-0.5">
    <div className="flex min-w-0 items-center gap-2 px-2">
      <span className="min-w-0 shrink truncate text-label text-muted-foreground">
        {cluster.title}
      </span>
      {cluster.sessionId === null ? null : (
        <TerminalGroupFacts sessionId={cluster.sessionId} isStatic />
      )}
    </div>
    {cluster.rows.map((row) => (
      <PickerRowView
        key={row.key}
        row={row}
        isActive={row.key === activeKey}
        onPick={() => onPick(row.target)}
        onOpenProject={() => onOpenProject(row)}
      />
    ))}
  </div>
);
