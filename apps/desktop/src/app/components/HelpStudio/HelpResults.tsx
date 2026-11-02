import { EmptyLine, Eyebrow, KeyHint, SelectableRow } from '@goodboy/ui';
import { pluralize } from '../../../shared/utils/pluralize';
import { queryWordsOf } from '../../../features/settings/components/GuideStudio/queryWordsOf';
import { HitLabel } from '../../../features/settings/components/GuideStudio/parts/HitLabel';
import { HELP_HIT_GROUP, type HelpHit } from './searchHelp';

type Props = {
  readonly query: string;
  readonly hits: ReadonlyArray<HelpHit>;
  readonly activeHit: number;
  readonly onOpenHit: (hit: HelpHit) => void;
};

type LabelParams = {
  readonly hit: HelpHit;
};

const hitLabelOf = ({ hit }: LabelParams): string => {
  switch (hit.kind) {
    case 'guide':
      return hit.hit.term ?? hit.hit.chapterTitle;
    case 'release':
      return hit.version;
    case 'shortcut':
      return hit.label;
    default: {
      const unreachable: never = hit;
      return unreachable;
    }
  }
};

const hitDetailOf = ({ hit }: LabelParams): string => {
  switch (hit.kind) {
    case 'guide':
      return hit.hit.term === null ? HELP_HIT_GROUP.guide : hit.hit.chapterTitle;
    case 'release':
      return HELP_HIT_GROUP.release;
    case 'shortcut':
      return HELP_HIT_GROUP.shortcut;
    default: {
      const unreachable: never = hit;
      return unreachable;
    }
  }
};

export const HelpResults = ({ query, hits, activeHit, onOpenHit }: Props) => {
  const words = queryWordsOf({ query });
  return (
    <div className="flex flex-col gap-0.5">
      {hits.length === 0 ? (
        <EmptyLine className="px-2 py-1 text-ui text-faint-foreground">
          Nothing in help matches "{query.trim()}".
        </EmptyLine>
      ) : (
        <Eyebrow label={pluralize(hits.length, 'result')} className="px-2 py-1" />
      )}
      <ul aria-label="Help results" className="flex flex-col gap-0.5 empty:hidden">
        {hits.map((hit, index) => (
          <li key={hit.key}>
            <SelectableRow
              selected={index === activeHit}
              ariaLabel={`${hitLabelOf({ hit })}, ${hitDetailOf({ hit })}`}
              onClick={() => onOpenHit(hit)}
              className="flex-col items-start gap-0 px-2 py-1"
            >
              <span className="flex w-full items-center justify-between gap-2 text-ui text-foreground">
                <span className="min-w-0 truncate">
                  <HitLabel text={hitLabelOf({ hit })} words={words} />
                </span>
                {hit.kind === 'shortcut' ? <KeyHint keys={hit.glyphs} /> : null}
              </span>
              <span className="w-full truncate text-ui text-faint-foreground">
                {hitDetailOf({ hit })}
              </span>
            </SelectableRow>
          </li>
        ))}
      </ul>
    </div>
  );
};
