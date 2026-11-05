import { extractBraceBlock } from './extractBraceBlock.mjs';

export const extractCssBlock = ({ stylesSource, selector }) => {
  const selectorIndex = stylesSource.indexOf(selector);
  if (selectorIndex === -1) {
    throw new Error(`Could not find ${selector} in styles.css`);
  }
  return extractBraceBlock({
    source: stylesSource,
    startIndex: selectorIndex,
    description: selector,
  });
};
