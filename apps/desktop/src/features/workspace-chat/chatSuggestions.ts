type Params = {
  readonly projectNames: ReadonlyArray<string>;
};

export const chatSuggestions = ({ projectNames }: Params): ReadonlyArray<string> => {
  const [first, second] = projectNames;
  if (first === undefined) {
    return [];
  }
  return [
    `What changed in ${first} this week?`,
    second === undefined
      ? `Where does ${first} start when it runs?`
      : `How do ${first} and ${second} talk to each other?`,
    `Explain how ${first} is laid out, in plain words`,
  ];
};
