import { extractCssValue } from './extractCssValue.mjs';
import { extractIconPath } from './extractIconPath.mjs';

export const resolveBrands = ({ brands, iconSource, themeSource }) =>
  brands.map(({ id, iconName, cssVar }) => ({
    id,
    path: extractIconPath({ iconSource, componentName: iconName }),
    color: extractCssValue({ cssSource: themeSource, variableName: cssVar }),
  }));
