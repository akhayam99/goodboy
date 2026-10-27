const DEFAULT_CLONE_PARENT = '~/Developer';

type Params = {
  readonly name: string;
};

export const defaultCloneDestination = ({ name }: Params): string =>
  `${DEFAULT_CLONE_PARENT}/${name}`;
