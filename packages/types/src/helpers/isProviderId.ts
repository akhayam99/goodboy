import { PROVIDER_IDS, type ProviderId } from '../provider-registry';

const PROVIDER_ID_SET: ReadonlySet<string> = new Set(PROVIDER_IDS);

export const isProviderId = (value: unknown): value is ProviderId =>
  typeof value === 'string' && PROVIDER_ID_SET.has(value);
