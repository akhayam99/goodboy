export const extractBraceBlock = ({ source, startIndex, description }) => {
  const openIndex = source.indexOf('{', startIndex);
  if (openIndex === -1) {
    throw new Error(`Could not find opening brace for ${description}`);
  }
  const characters = source.slice(openIndex);
  const closingOffset = characters.split('').reduce(
    (state, character, index) => {
      if (state.closingOffset !== -1) {
        return state;
      }
      const depth =
        character === '{' ? state.depth + 1 : character === '}' ? state.depth - 1 : state.depth;
      return {
        depth,
        closingOffset: depth === 0 ? index : -1,
      };
    },
    { depth: 0, closingOffset: -1 },
  ).closingOffset;
  if (closingOffset === -1) {
    throw new Error(`Could not find closing brace for ${description}`);
  }
  return characters.slice(0, closingOffset + 1);
};
