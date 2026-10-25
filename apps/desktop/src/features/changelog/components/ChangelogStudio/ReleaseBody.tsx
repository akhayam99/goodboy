import { Eyebrow, Markdown, Notice } from '@goodboy/ui';
import { releaseMeta } from '../../releaseMeta';
import { uniquePrs } from '../../releasePrs';
import type { ChangelogScreen } from '../../changelogScreens';
import type { ReleaseEntry } from '../../parseChangelog';
import { FeatureBlock } from './FeatureBlock';
import { FixRow } from './FixRow';
import { PrRef } from './PrRef';

type Props = {
  readonly release: ReleaseEntry;
  readonly dateLabel: string | null;
  readonly installedVersion: string | null;
  readonly featureHeadingLevel?: 2 | 3;
  readonly isMetaShown?: boolean;
  readonly onOpenScreen?: (params: { readonly screen: ChangelogScreen }) => void;
};

export const ReleaseBody = ({
  release,
  dateLabel,
  installedVersion,
  featureHeadingLevel = 2,
  isMetaShown = true,
  onOpenScreen,
}: Props) => {
  const prs = uniquePrs({ release });
  const showPrInMeta = prs.length === 1;
  const metaLine = releaseMeta({ release, dateLabel, installedVersion });

  return (
    <div className="flex flex-col gap-6">
      {isMetaShown && (metaLine !== '' || showPrInMeta) ? (
        <div className="flex items-center gap-2">
          <span className="text-meta text-muted-foreground">{metaLine}</span>
          {showPrInMeta ? <PrRef prs={prs} /> : null}
        </div>
      ) : null}
      {release.shape === 'v2' && release.lead !== null ? (
        <p className="text-body text-muted-foreground">{release.lead}</p>
      ) : null}
      {release.shape === 'v2' && release.oneWayFrom !== null ? (
        <Notice
          tone="warning"
          placement="inline"
          title="This version updates your data in one direction"
          body={`To go back to ${release.oneWayFrom}, restore the backup Goodboy made before updating.`}
        />
      ) : null}
      {release.shape === 'v2' && release.sections.new.length > 0 ? (
        <div className="flex flex-col gap-4">
          <Eyebrow label={`New ${release.sections.new.length}`} />
          {release.sections.new.map((feature) => (
            <FeatureBlock
              key={feature.title}
              version={release.version}
              feature={feature}
              showPrRef={!showPrInMeta}
              headingLevel={featureHeadingLevel}
              hasBefore={false}
              onOpenScreen={onOpenScreen}
            />
          ))}
        </div>
      ) : null}
      {release.shape === 'v2' && release.sections.improved.length > 0 ? (
        <div className="flex flex-col gap-4">
          <Eyebrow label={`Improved ${release.sections.improved.length}`} />
          {release.sections.improved.map((feature) => (
            <FeatureBlock
              key={feature.title}
              version={release.version}
              feature={feature}
              showPrRef={!showPrInMeta}
              headingLevel={featureHeadingLevel}
              hasBefore={true}
              onOpenScreen={onOpenScreen}
            />
          ))}
        </div>
      ) : null}
      {release.shape === 'v2' && release.sections.fixed.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          <Eyebrow label={`Fixed ${release.sections.fixed.length}`} />
          {release.sections.fixed.map((fix, index) => (
            <FixRow key={index} fix={fix} showPrRef={!showPrInMeta} />
          ))}
        </div>
      ) : null}
      {release.shape === 'markdown' && release.markdown !== null ? (
        <Markdown text={release.markdown} className="text-prose" />
      ) : null}
    </div>
  );
};
