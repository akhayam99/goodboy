import type { LucideIcon } from 'lucide-react';
import { Eyebrow, ROW_INTERACTIVE, TruncatedText, cn } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { activityRowConcept, type ActivityRowKind } from '../../../../timeline/activityRowConcept';
import type { NeedsYouOwner, NeedsYouOwnerKind } from '../../../../timeline/needsYou';
import { runWorkflowKind } from '../../../../timeline/runWorkflowKind';
import { RUN_KIND_GLYPH } from './runKindGlyph';

type Props = {
  readonly owners: ReadonlyArray<NeedsYouOwner>;
  readonly onOpen: (params: { readonly owner: NeedsYouOwner }) => void;
};

const OWNER_ROW_KIND: Readonly<Record<NeedsYouOwnerKind, ActivityRowKind>> = {
  fixRun: 'fix-run',
  run: 'workflow-run',
  agent: 'agent',
  question: 'question',
  rebase: 'rebase',
};

type OwnerParams = {
  readonly owner: NeedsYouOwner;
};

const ownerIcon = ({ owner }: OwnerParams): LucideIcon => {
  const entry = owner.item?.entry;
  if (owner.kind === 'run' && entry?.kind === 'run') {
    return RUN_KIND_GLYPH[runWorkflowKind({ workflow: entry.workflow })].icon;
  }
  return CONCEPT_ICONS[activityRowConcept({ kind: OWNER_ROW_KIND[owner.kind] })];
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
          const Icon = ownerIcon({ owner });
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
