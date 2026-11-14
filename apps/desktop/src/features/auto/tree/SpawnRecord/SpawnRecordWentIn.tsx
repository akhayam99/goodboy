import { FileText, Folder, Image, MessageSquare, type LucideIcon } from 'lucide-react';
import { ICON_SIZE } from '@goodboy/ui';
import type { LaunchSnapshotItem, LaunchSnapshotKind } from '../../chat/launchSnapshotOf';
import { SPAWN_RECORD_NOT_RECORDED, SPAWN_RECORD_NOTHING_GIVEN } from '../spawnRecordOf';

const ICONS: Readonly<Record<LaunchSnapshotKind, LucideIcon>> = {
  note: MessageSquare,
  result: FileText,
  artifact: FileText,
  guidance: Folder,
  image: Image,
};

type Props = {
  readonly items: ReadonlyArray<LaunchSnapshotItem> | null;
};

export const SpawnRecordWentIn = ({ items }: Props) => {
  if (items === null) {
    return <span className="text-muted-foreground">{SPAWN_RECORD_NOT_RECORDED}</span>;
  }
  if (items.length === 0) {
    return <span className="text-muted-foreground">{SPAWN_RECORD_NOTHING_GIVEN}</span>;
  }
  return (
    <ul aria-label="Given to the agent" className="flex min-w-0 flex-col gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.kind];
        return (
          <li key={`${item.kind}:${item.ref}`} className="flex min-w-0 items-start gap-2">
            <Icon size={ICON_SIZE.control} className="shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0">
              {item.label}
              {item.detail === null ? null : (
                <span className="text-muted-foreground">{` · ${item.detail}`}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
};
