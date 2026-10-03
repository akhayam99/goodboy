import { PROVIDER_ORDER } from './components/ProviderStudio/providerOrder';

type Params<T> = {
  readonly providers: ReadonlyArray<T>;
};

export const orderProviders = <T extends { readonly id: string }>({
  providers,
}: Params<T>): ReadonlyArray<T> =>
  PROVIDER_ORDER.map((id) => providers.find((provider) => provider.id === id)).filter(
    (provider): provider is T => provider !== undefined,
  );
