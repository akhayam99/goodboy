export const requireMatch = ({ source, pattern, description }) => {
  const match = source.match(pattern);
  if (match !== null) {
    return match;
  }
  throw new Error(`Could not find ${description}`);
};
