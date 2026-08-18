import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';

type RoutingPickerConstants = {
  readonly providers: ReadonlyArray<ProviderId>;
  readonly emptyModelKeys: ReadonlySet<string>;
  readonly providerChipGroupClassName: string;
};

export const ROUTING_PICKER_CONSTANTS = {
  providers: Object.keys(PROVIDER_CAPABILITIES).filter(
    (id): id is ProviderId => id in PROVIDER_CAPABILITIES,
  ),
  emptyModelKeys: new Set<string>(),
  providerChipGroupClassName: 'flex gap-1.5 bg-subtle px-2.5 [&>*]:h-7 [&>*]:flex-1',
} satisfies RoutingPickerConstants;
