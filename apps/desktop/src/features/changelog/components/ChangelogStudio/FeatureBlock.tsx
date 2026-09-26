import type { ChangelogFeature } from '../../parseChangelog';
import type { ChangelogScreen } from '../../changelogScreens';
import { AreaTag } from './AreaTag';
import { OpenScreenLink } from './OpenScreenLink';
import { PrRef } from './PrRef';

type Props = {
  readonly feature: ChangelogFeature;
  readonly showPrRef: boolean;
  readonly onOpenScreen?: (params: { readonly screen: ChangelogScreen }) => void;
};

export const FeatureBlock = ({ feature, showPrRef, onOpenScreen }: Props) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-start justify-between gap-2">
      <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
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
