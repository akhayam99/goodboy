import { SquareArrowOutUpRight, type LucideIcon } from 'lucide-react';
import { BitbucketIcon, GithubIcon, GitlabIcon } from '@goodboy/ui';

type Host = 'github' | 'gitlab' | 'bitbucket' | 'local';

type Params = {
  readonly host: Host;
};

const HOST_ICON: Readonly<Record<Host, LucideIcon>> = {
  github: GithubIcon,
  gitlab: GitlabIcon,
  bitbucket: BitbucketIcon,
  local: SquareArrowOutUpRight,
};

export const hostIconOf = ({ host }: Params): LucideIcon => HOST_ICON[host];
