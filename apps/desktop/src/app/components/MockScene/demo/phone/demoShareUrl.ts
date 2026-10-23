import { DEMO_GROUPS } from '../demoGroups';
import { DEFAULT_GROUP_ID } from '../defaultGroupId';
import { PHONE_LINKS } from './phoneLinks';

type Params = {
  readonly hash: string;
};

export const demoShareUrl = ({ hash }: Params): string => {
  const wanted = hash.replace(/^#/, '');
  const group = Object.values(DEMO_GROUPS).find((entry) => entry.id === wanted);
  if (group === undefined || group.id === DEFAULT_GROUP_ID) {
    return PHONE_LINKS.demo;
  }
  return `${PHONE_LINKS.demo}#${group.id}`;
};
