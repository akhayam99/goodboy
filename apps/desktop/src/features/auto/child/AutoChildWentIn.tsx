import { FileText, Folder, Image, MessageSquare, type LucideIcon } from 'lucide-react';
import { ICON_SIZE } from '@goodboy/ui';
import type { LaunchSnapshotItem, LaunchSnapshotKind } from '../chat/launchSnapshotOf';

export const AUTO_CHILD_NOTHING_GIVEN = 'Nothing was given to the agent.';

const ICONS: Readonly<Record<LaunchSnapshotKind, LucideIcon>> = {
  note: MessageSquare,
  result: FileText,
  artifact: FileText,
  guidance: Folder,
  image: Image,
};

type Props = {
  readonly items: ReadonlyArray<LaunchSnapshotItem>;
};

export const AutoChildWentIn = ({ items }: Props) => {
  if (items.length === 0) {
    return (
      <p data-auto-child-went-in="" className="text-foreground">
        <span className="text-muted-foreground">Went in: </span>
        {AUTO_CHILD_NOTHING_GIVEN}
      </p>
    );
  }
  return (
    <div data-auto-child-went-in="" className="flex min-w-0 flex-col gap-1">
      <span className="text-muted-foreground">Went in:</span>
      <ul aria-label="Given to the agent" className="flex min-w-0 flex-col gap-1">
        {items.map((item) => {
          const Icon = ICONS[item.kind];
          return (
            <li key={`${item.kind}:${item.ref}`} className="flex min-w-0 items-start gap-2">
              <Icon
                size={ICON_SIZE.control}
                className="shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 text-foreground">
                {item.label}
                {item.detail === null ? null : (
                  <span className="text-muted-foreground">{` · ${item.detail}`}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
