type LandingScope =
  'decisions' | 'questions' | 'resolve-thread' | 'resolve-agent' | 'handoff' | 'transcript-event';

type Params = {
  readonly scope: LandingScope;
  readonly id: string;
};

export const landingLiveKey = ({ scope, id }: Params): string => `landing:${scope}:${id}`;
