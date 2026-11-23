type Params = {
  readonly suggestions: ReadonlyArray<string>;
  readonly recommendedAnswer: string;
};

export const orderSuggestions = ({
  suggestions,
  recommendedAnswer,
}: Params): ReadonlyArray<string> => {
  const unique = [...new Set(suggestions)];
  if (recommendedAnswer === '') {
    return unique;
  }
  return [recommendedAnswer, ...unique.filter((suggestion) => suggestion !== recommendedAnswer)];
};
