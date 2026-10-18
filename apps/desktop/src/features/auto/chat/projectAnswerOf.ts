export type ProjectPick = Readonly<{
  key: string;
  name: string;
}>;

export type ProjectAnswer = Readonly<{
  label: string;
  message: string | null;
}>;

type Params = {
  readonly picks: ReadonlyArray<ProjectPick>;
  readonly roleNoun: string;
};

type ListParams = {
  readonly names: ReadonlyArray<string>;
};

const listOf = ({ names }: ListParams): string => {
  if (names.length < 2) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;
};

export const projectAnswerOf = ({ picks, roleNoun }: Params): ProjectAnswer => {
  const names = picks.map((pick) => pick.name);
  const only = names[0];
  if (names.length === 0 || only === undefined) {
    return { label: 'Choose a folder', message: null };
  }
  if (names.length === 1) {
    return { label: `Use ${only}`, message: `Use ${only} for the ${roleNoun}.` };
  }
  return {
    label: names.length === 2 ? 'Use both' : `Use ${names.length} folders`,
    message: `Use ${listOf({ names })}: start one ${roleNoun} per folder.`,
  };
};
