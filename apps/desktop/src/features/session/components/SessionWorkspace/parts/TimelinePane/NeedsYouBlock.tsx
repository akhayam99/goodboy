import { AlertTriangle, GitBranch, MessageSquare, Workflow } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, Eyebrow, cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import type { NeedsYouOwner, NeedsYouOwnerKind } from '../../../../timeline/needsYou';

type Props = {
  readonly owners: ReadonlyArray<NeedsYouOwner>;
  readonly onOpen: (params: { readonly owner: NeedsYouOwner }) => void;
};

const OWNER_ICON: Readonly<Record<NeedsYouOwnerKind, LucideIcon>> = {
  batch: MessageSquare,
  run: Workflow,
  agent: MessageSquare,
  question: MessageSquare,
  rebase: GitBranch,
};

export const NeedsYouBlock = ({ owners, onOpen }: Props) => {
  if (owners.length === 0) {
    return null;
  }
  return (
    <section
      aria-label="Needs you"
      data-testid="needs-you-block"
      className="flex flex-col rounded-lg bg-subtle p-1 ring-1 ring-border-soft"
    >
      <Eyebrow
        label="Needs you"
        icon={<AlertTriangle size={ICON_SIZE.row} aria-hidden className="shrink-0" />}
        tone="warning"
        className="flex items-center gap-2 px-3 pb-1 pt-2"
      />
      <ul className="flex flex-col">
        {owners.map((owner) => {
          const Icon = OWNER_ICON[owner.kind];
          return (
            <li
              key={owner.id}
              data-testid="needs-you-owner"
              className="flex min-h-9 items-center gap-2 rounded-md px-3 text-row"
            >
              <Icon
                size={ICON_SIZE.row}
                aria-hidden
                className={cn('shrink-0', tintClasses('warning').text)}
              />
              <span className="min-w-0 flex-1 truncate text-foreground" title={owner.text}>
                {owner.text}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 shrink-0"
                aria-label={`Open: ${owner.text}`}
                onClick={() => onOpen({ owner })}
              >
                Open
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
