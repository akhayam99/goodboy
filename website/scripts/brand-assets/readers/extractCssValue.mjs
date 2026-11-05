import { requireMatch } from './requireMatch.mjs';

export const extractCssValue = ({ cssSource, variableName }) =>
  requireMatch({
    source: cssSource,
    pattern: new RegExp(`${variableName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*:\\s*([^;]+);`),
    description: `${variableName} in the theme block`,
  })[1].trim();
