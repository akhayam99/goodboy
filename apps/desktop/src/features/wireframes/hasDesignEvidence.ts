import type { DesignProfile } from './collectDesignProfile';

type Params = Readonly<{
  profile: DesignProfile;
}>;

export const hasDesignEvidence = ({ profile }: Params): boolean =>
  profile.tailwind !== null ||
  profile.tokens.length > 0 ||
  profile.variants.length > 0 ||
  profile.layoutExamples.length > 0;
