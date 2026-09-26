import type { ChangelogFeature } from '../../parseChangelog';
import type { ChangelogScreen } from '../../changelogScreens';
import { AreaTag } from './AreaTag';
import { OpenScreenLink } from './OpenScreenLink';
import { PrRef } from './PrRef';

const HEADING_TAG = {
  2: 'h2',
  3: 'h3',
} as const satisfies Record<2 | 3, 'h2' | 'h3'>;

type Props = {
  readonly feature: ChangelogFeature;
  readonly showPrRef: boolean;
  readonly headingLevel: 2 | 3;
  readonly onOpenScreen?: (params: { readonly screen: ChangelogScreen }) => void;
};

export const FeatureBlock = ({ feature, showPrRef, headingLevel, onOpenScreen }: Props) => {
  const Heading = HEADING_TAG[headingLevel];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <Heading className="text-sm font-semibold text-foreground">{feature.title}</Heading>
        <div className="flex items-center gap-2">
          <AreaTag area={feature.area} />
          {showPrRef ? <PrRef prs={feature.prs} /> : null}
        </div>
      </div>
      {feature.paragraphs.map((paragraph, index) => (
        <p key={index} className="text-xs leading-[1.62] text-muted-foreground">
          {paragraph}
        </p>
      ))}
      <OpenScreenLink screen={feature.screen} onOpenScreen={onOpenScreen} />
    </div>
  );
};
