import type { ChangelogFeature } from './parseChangelog';

export type ChangelogImageVariant = 'before' | 'after';
export type ChangelogImageTheme = 'dark' | 'light';

export const CHANGELOG_IMAGE_THEMES: ReadonlyArray<ChangelogImageTheme> = ['dark', 'light'];

type FileNameParams = {
  readonly image: string;
  readonly variant: ChangelogImageVariant;
  readonly theme: ChangelogImageTheme;
};

export const changelogImageFileName = ({ image, variant, theme }: FileNameParams): string =>
  `${image}-${variant}-${theme}.webp`;

type VariantsForFeatureParams = {
  readonly hasBefore: boolean;
};

export const changelogImageVariants = ({
  hasBefore,
}: VariantsForFeatureParams): ReadonlyArray<ChangelogImageVariant> =>
  hasBefore ? ['before', 'after'] : ['after'];

type FeatureImageFilesParams = {
  readonly feature: ChangelogFeature;
  readonly hasBefore: boolean;
};

export const changelogImageFilesForFeature = ({
  feature,
  hasBefore,
}: FeatureImageFilesParams): ReadonlyArray<string> => {
  if (feature.image === null) {
    return [];
  }
  const image = feature.image;
  return changelogImageVariants({ hasBefore }).flatMap((variant) =>
    CHANGELOG_IMAGE_THEMES.map((theme) => changelogImageFileName({ image, variant, theme })),
  );
};
