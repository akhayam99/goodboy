import type { Guide } from '../Guide';
import { GUIDES } from './GUIDES';

type Params = {
  readonly paths: readonly string[];
};

export const guidesOfPaths = ({ paths }: Params): readonly Guide[] =>
  paths.flatMap((path) => GUIDES.filter((guide) => guide.path === path));
