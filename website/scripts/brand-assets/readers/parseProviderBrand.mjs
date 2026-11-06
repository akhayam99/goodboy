import { extractBraceBlock } from './extractBraceBlock.mjs';

export const parseProviderBrand = ({ providerBrandSource, providerIds }) => {
  const declarationIndex = providerBrandSource.indexOf('export const PROVIDER_BRAND');
  if (declarationIndex === -1) {
    throw new Error('Could not find PROVIDER_BRAND in provider-brand.ts');
  }
  const block = extractBraceBlock({
    source: providerBrandSource,
    startIndex: declarationIndex,
    description: 'PROVIDER_BRAND',
  });
  const entries = [
    ...block.matchAll(
      /([a-z][a-z0-9]*):\s*\{\s*icon:\s*([A-Za-z][A-Za-z0-9]*),\s*cssVar:\s*['"]([^'"]+)['"]\s*\}/g,
    ),
  ].reduce(
    (brands, match) => ({
      ...brands,
      [match[1]]: { iconName: match[2], cssVar: match[3] },
    }),
    {},
  );
  return providerIds.map((id) => {
    const entry = entries[id];
    if (entry !== undefined) {
      return { id, ...entry };
    }
    throw new Error(`Could not find PROVIDER_BRAND entry for ${id}`);
  });
};
