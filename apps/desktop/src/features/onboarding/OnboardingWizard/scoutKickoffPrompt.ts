const SCOUT_BRIEF =
  'Read this project and suggest where to start: what needs doing, and which piece to pick up first.';

type Params = {
  readonly focus: string;
};

export const scoutKickoffPrompt = ({ focus }: Params): string => {
  const trimmed = focus.trim();
  return trimmed === '' ? SCOUT_BRIEF : `${SCOUT_BRIEF}\n\nFocus on: ${trimmed}`;
};
