import { Tooltip } from '@goodboy/ui';
import type { ResolvedFact } from '../../../detail-fields/factTypes';
import { ICON_SIZE } from '../../conceptIcons';

type Props = {
  readonly facts: ReadonlyArray<ResolvedFact>;
};

export const RecordFacts = ({ facts }: Props) => {
  if (facts.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Facts" data-slot="record-facts" className="flex min-w-0 flex-wrap gap-1.5">
      {facts.map((fact) => {
        const Icon = fact.icon;
        return (
          <li key={`${fact.slot}-${fact.key}`} data-fact-slot={fact.slot} className="min-w-0">
            <Tooltip content={fact.hint ?? fact.label}>
              <span className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-md bg-subtle px-2 text-2xs text-muted-foreground ring-1 ring-inset ring-border-soft">
                {Icon == null ? null : (
                  <Icon
                    size={ICON_SIZE.row}
                    aria-hidden
                    className="shrink-0 text-faint-foreground"
                  />
                )}
                <span className="min-w-0 truncate">{fact.node}</span>
              </span>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
};
