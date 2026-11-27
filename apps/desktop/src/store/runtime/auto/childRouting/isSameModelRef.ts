import { catalogModelForId } from '@goodboy/core/providers';
import { isProviderId } from '@goodboy/types/helpers';
import type { RoutedModelRef } from '../ports';

type KeyParams = {
  readonly ref: RoutedModelRef;
};

const refKeyOf = ({ ref }: KeyParams): string => {
  const key = isProviderId(ref.provider)
    ? catalogModelForId({ provider: ref.provider, modelId: ref.model })?.key
    : undefined;
  return key ?? ref.model;
};

type Params = {
  readonly left: RoutedModelRef;
  readonly right: RoutedModelRef;
};

export const isSameModelRef = ({ left, right }: Params): boolean =>
  left.provider === right.provider && refKeyOf({ ref: left }) === refKeyOf({ ref: right });
