type ParamParams = {
  readonly key: string;
};

export const sceneParam = ({ key }: ParamParams): string | null =>
  new URLSearchParams(window.location.search).get(key);

type ListParams = ParamParams & {
  readonly separator: string;
};

export const sceneParamList = ({ key, separator }: ListParams): ReadonlyArray<string> =>
  (sceneParam({ key }) ?? '').split(separator).filter((entry) => entry !== '');
