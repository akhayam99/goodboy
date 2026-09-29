const COLLAPSED_BY_DEFAULT: ReadonlyArray<string> = ['done', 'merged', 'closed'];

type Params = {
  readonly key: string;
  readonly overrides: Readonly<Record<string, boolean>>;
};

export const isSessionGroupCollapsed = ({ key, overrides }: Params): boolean => {
  const isExpanded = overrides[key];
  return isExpanded === undefined ? COLLAPSED_BY_DEFAULT.includes(key) : !isExpanded;
};
