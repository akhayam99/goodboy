import { GitBranch, MessageSquare, Workflow } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Eyebrow, ROW_INTERACTIVE, TruncatedText, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import type { NeedsYouOwner, NeedsYouOwnerKind } from '../../../../timeline/needsYou';

type Props = {
  readonly owners: ReadonlyArray<NeedsYouOwner>;
  readonly onOpen: (params: { readonly owner: NeedsYouOwner }) => void;
};

const OWNER_ICON: Readonly<Record<NeedsYouOwnerKind, LucideIcon>> = {
  fixRun: MessageSquare,
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
      className="flex flex-col gap-1 rounded-md bg-subtle p-1"
    >
      <Eyebrow label="Needs you" className="flex h-7 items-center px-3" />
      <ul className="flex flex-col">
        {owners.map((owner) => {
          const Icon = OWNER_ICON[owner.kind];
          return (
            <li key={owner.id} data-testid="needs-you-owner" className="flex">
              <button
                type="button"
                aria-label={`Open: ${owner.where === null ? owner.text : `${owner.text}, ${owner.where}`}`}
                onClick={() => onOpen({ owner })}
                className={cn(
                  'flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-3 text-left text-row',
                  ROW_INTERACTIVE,
                )}
              >
                <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
                <TruncatedText className="min-w-0 truncate text-foreground">
                  {owner.text}
                </TruncatedText>
                {owner.where === null ? null : (
                  <TruncatedText className="min-w-0 max-w-[40%] shrink-[2] truncate text-muted-foreground">
                    {owner.where}
                  </TruncatedText>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
