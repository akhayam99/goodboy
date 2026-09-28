import type { SearchHit } from '@goodboy/types';
import { Button, Eyebrow, tintClasses } from '@goodboy/ui';
import { formatAbsoluteDateTime } from '../../../../shared/utils/relativeDate';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { SEARCH_KIND_META } from '../../searchKindMeta';
import { hitHeadline } from '../../hitLabels';
import type { SearchHitTarget } from '../../searchHitTarget';
import { hitActionTarget } from '../../hitActionTarget';
import { MarkedText } from './MarkedText';
import { SearchHitActions } from './SearchHitActions';

type Props = {
  readonly hit: SearchHit;
  readonly target: SearchHitTarget;
  readonly onOpen: () => void;
  readonly onDone: () => void;
};

type HitParams = {
  readonly hit: SearchHit;
};

const statusOf = ({ hit }: HitParams): string | null => {
  if (hit.isArchived) {
    return 'archived';
  }
  return hit.kind === 'message' ? null : hit.status;
};

type Fact = {
  readonly label: string;
  readonly value: string | null;
};

export const SearchPreview = ({ hit, target, onOpen, onDone }: Props) => {
  const meta = SEARCH_KIND_META[hit.kind];
  const Icon = meta.icon;
  const actionTarget = hitActionTarget({ hit });
  const facts: ReadonlyArray<Fact> = [
    { label: 'Session', value: hit.kind === 'session' ? null : hit.sessionTitle },
    { label: 'Agent', value: hit.kind === 'agent' ? null : hit.agentName },
    { label: 'Where', value: hit.container },
    { label: 'Status', value: statusOf({ hit }) },
    { label: 'From', value: hit.provider },
    { label: 'When', value: formatAbsoluteDateTime({ iso: hit.occurredAt }) },
  ];
  const isBlocked = target.kind === 'blocked';
  return (
    <aside
      aria-label="Preview"
      className="flex w-80 shrink-0 flex-col gap-4 border-l border-border-soft p-4"
    >
      <div className="flex flex-col gap-2">
        <Eyebrow
          label={meta.label}
          icon={<Icon size={ICON_SIZE.row} aria-hidden className={tintClasses(meta.tone).text} />}
        />
        <h3 className="line-clamp-3 text-heading text-foreground">
          <MarkedText segments={hitHeadline({ hit })} />
        </h3>
        {hit.snippet.length > 0 ? (
          <p className="line-clamp-6 text-prose text-muted-foreground">
            <MarkedText segments={hit.snippet} />
          </p>
        ) : null}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {facts.flatMap((fact) =>
          fact.value === null || fact.value.length === 0
            ? []
            : [
                <dt key={`${fact.label}-t`} className="text-label text-faint-foreground">
                  {fact.label}
                </dt>,
                <dd key={`${fact.label}-d`} className="truncate text-label text-foreground">
                  {fact.value}
                </dd>,
              ],
        )}
      </dl>
      <div className="flex flex-col gap-2">
        <Button
          size="sm"
          variant={isBlocked ? 'secondary' : 'primary'}
          disabled={isBlocked}
          onClick={onOpen}
          className="self-start"
        >
          {target.label}
          <span aria-hidden className="text-meta">
            ↵
          </span>
        </Button>
        {target.kind === 'blocked' ? (
          <p className="text-label text-muted-foreground">{target.reason}</p>
        ) : null}
      </div>
      {actionTarget === null ? null : (
        <SearchHitActions key={hit.docId} target={actionTarget} onDone={onDone} />
      )}
    </aside>
  );
};
