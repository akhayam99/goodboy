import { Button, EmptyLine, Eyebrow, SelectableRow } from '@goodboy/ui';
import { pluralize } from '../../../shared/utils/pluralize';
import { queryWordsOf } from '../../../features/settings/components/GuideStudio/queryWordsOf';
import { HitLabel } from '../../../features/settings/components/GuideStudio/parts/HitLabel';
import { HELP_HIT_GROUP, type HelpHit } from './searchHelp';

type Props = {
  readonly query: string;
  readonly hits: ReadonlyArray<HelpHit>;
  readonly hiddenReleaseCount: number;
  readonly activeHit: number;
  readonly onOpenHit: (hit: HelpHit) => void;
  readonly onShowAllReleases: () => void;
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
    default: {
      const unreachable: never = hit;
      return unreachable;
    }
  }
};

const hitLineOf = ({ hit }: LabelParams): string =>
  hit.kind === 'guide' ? `${hitDetailOf({ hit })} · ${hit.hit.excerpt}` : hitDetailOf({ hit });

export const HelpResults = ({
  query,
  hits,
  hiddenReleaseCount,
  activeHit,
  onOpenHit,
  onShowAllReleases,
}: Props) => {
  const words = queryWordsOf({ query });
  return (
    <div className="flex flex-col gap-0.5">
      {hits.length === 0 ? (
        <EmptyLine className="px-2 py-1 text-ui text-faint-foreground">
          Nothing in help matches "{query.trim()}".
        </EmptyLine>
      ) : (
        <Eyebrow
          label={pluralize(hits.length + hiddenReleaseCount, 'result')}
          className="px-2 py-1"
        />
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
              <span className="w-full truncate text-ui text-foreground">
                <HitLabel text={hitLabelOf({ hit })} words={words} />
              </span>
              <span className="w-full truncate text-ui text-faint-foreground">
                <HitLabel text={hitLineOf({ hit })} words={words} />
              </span>
            </SelectableRow>
          </li>
        ))}
      </ul>
      {hiddenReleaseCount > 0 ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={onShowAllReleases}>
          Show {hiddenReleaseCount} more in {HELP_HIT_GROUP.release}
        </Button>
      ) : null}
    </div>
  );
};
