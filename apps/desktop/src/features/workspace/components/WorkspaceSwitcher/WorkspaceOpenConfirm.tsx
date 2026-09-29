import { TriangleAlert } from 'lucide-react';
import { InlineConfirm } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly targetName: string;
  readonly currentName: string;
  readonly running: number;
  readonly onOpenNewWindow: () => void;
  readonly onStopAndOpenHere: () => void;
  readonly onCancel: () => void;
};

const activeLine = ({ running, currentName }: { running: number; currentName: string }): string =>
  running === 1
    ? `1 session is active in ${currentName}.`
    : `${running} sessions are active in ${currentName}.`;

export const WorkspaceOpenConfirm = ({
  targetName,
  currentName,
  running,
  onOpenNewWindow,
  onStopAndOpenHere,
  onCancel,
}: Props) => {
  return (
    <InlineConfirm
      role="alert"
      surface="plain"
      icon={<TriangleAlert size={ICON_SIZE.row} aria-hidden />}
      title={activeLine({ running, currentName })}
      description={`Opening ${targetName} here stops them. A new window keeps them going.`}
      confirmLabel="Open in new window"
      altAction={{ label: 'Stop them and open here', onClick: onStopAndOpenHere }}
      onConfirm={onOpenNewWindow}
      onCancel={onCancel}
    />
  );
};
