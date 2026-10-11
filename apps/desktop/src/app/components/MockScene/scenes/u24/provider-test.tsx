import type { ComponentType } from 'react';
import { ProviderTestScene } from './provider-test/ProviderTestScene';

export const U24_PROVIDER_TEST_SCENES: Readonly<Record<string, ComponentType>> = {
  'providertest-ok': ProviderTestScene,
  'providertest-refused': ProviderTestScene,
  providerhistory: ProviderTestScene,
};
