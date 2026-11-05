import { extractQuotedValues } from './extractQuotedValues.mjs';
import { requireMatch } from './requireMatch.mjs';

export const parseProviderIds = (providerRegistrySource) => {
  const arraySource = requireMatch({
    source: providerRegistrySource,
    pattern: /export const PROVIDER_IDS\s*=\s*\[([\s\S]*?)\]\s*as const/,
    description: 'PROVIDER_IDS in provider-registry.ts',
  })[1];
  return extractQuotedValues({ source: arraySource, description: 'PROVIDER_IDS' });
};
