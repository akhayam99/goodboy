import type { MountFacts } from './mountFacts';

type Params = {
  readonly facts: Pick<MountFacts, 'dirty' | 'unpushed'>;
};

export const hasWorkOnlyInFolderOf = ({ facts }: Params): boolean =>
  facts.dirty > 0 || facts.unpushed > 0;
