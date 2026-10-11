import { languageForPath } from '../../shared/lib/highlight';

type Params = {
  readonly name: string;
};

export const isCodeFile = ({ name }: Params): boolean => {
  const lang = languageForPath(name);
  return lang !== null && lang !== 'markdown';
};
