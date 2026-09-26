import { Eyebrow, Markdown, Notice } from '@goodboy/ui';
import { isInstalledRelease } from '../../isInstalledRelease';
import { isNewerRelease } from '../../isNewerRelease';
import { uniquePrs } from '../../releasePrs';
import type { ChangelogScreen } from '../../changelogScreens';
import type { ReleaseEntry } from '../../parseChangelog';
import { FeatureBlock } from './FeatureBlock';
import { FixRow } from './FixRow';
import { PrRef } from './PrRef';

type ReleaseHeaderMetaParams = {
  readonly release: ReleaseEntry;
  readonly dateLabel: string | null;
};

export const releaseHeaderMeta = ({ release, dateLabel }: ReleaseHeaderMetaParams): string => {
  if (release.shape !== 'v2') {
    return dateLabel ?? '';
  }
  const featureCount = release.sections.new.length + release.sections.improved.length;
  const fixCount = release.sections.fixed.length;
  const parts = [
    dateLabel,
    featureCount > 0 ? `${featureCount} feature${featureCount === 1 ? '' : 's'}` : null,
    fixCount > 0 ? `${fixCount} fix${fixCount === 1 ? '' : 'es'}` : null,
  ].filter((part): part is string => part !== null);
  return parts.join(' · ');
};

export type ReleaseEyebrowLabel = 'Installed' | 'Available' | null;

export const releaseEyebrowLabel = ({
  release,
  installedVersion,
}: {
  readonly release: ReleaseEntry;
  readonly installedVersion: string | null;
}): ReleaseEyebrowLabel => {
  if (isInstalledRelease({ tag: release.version, installed: installedVersion })) {
    return 'Installed';
  }
  if (isNewerRelease({ tag: release.version, installed: installedVersion })) {
    return 'Available';
  }
  return null;
};

type Props = {
  readonly release: ReleaseEntry;
  readonly dateLabel: string | null;
  readonly installedVersion: string | null;
  readonly onOpenScreen?: (params: { readonly screen: ChangelogScreen }) => void;
};

export const ReleaseBody = ({ release, dateLabel, installedVersion, onOpenScreen }: Props) => {
  const prs = uniquePrs({ release });
  const showPrInMeta = prs.length === 1;
  const eyebrowLabel = releaseEyebrowLabel({ release, installedVersion });
  const metaLine = releaseHeaderMeta({ release, dateLabel });

  return (
    <div className="flex flex-col gap-5">
      {eyebrowLabel !== null || metaLine !== '' || showPrInMeta ? (
        <div className="flex items-center gap-2">
          {eyebrowLabel !== null ? <Eyebrow label={eyebrowLabel} /> : null}
          <span className="text-xs text-muted-foreground">{metaLine}</span>
          {showPrInMeta ? <PrRef prs={prs} /> : null}
        </div>
      ) : null}
      {release.shape === 'v2' && release.lead !== null ? (
        <p className="text-base text-muted-foreground">{release.lead}</p>
      ) : null}
      {release.shape === 'v2' && release.oneWayFrom !== null ? (
        <Notice
          tone="warning"
          placement="inline"
          title="This version updates your data in one direction."
          body={`To go back to ${release.oneWayFrom}, restore the backup Goodboy made before updating.`}
        />
      ) : null}
      {release.shape === 'v2' && release.sections.new.length > 0 ? (
        <div className="flex flex-col gap-4">
          <Eyebrow label={`New ${release.sections.new.length}`} />
          {release.sections.new.map((feature) => (
            <FeatureBlock
              key={feature.title}
              feature={feature}
              showPrRef={!showPrInMeta}
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
              feature={feature}
              showPrRef={!showPrInMeta}
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
        <Markdown text={release.markdown} className="text-sm leading-relaxed" />
      ) : null}
    </div>
  );
};
