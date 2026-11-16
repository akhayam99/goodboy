import { SquareArrowOutUpRight, type IconGlyph } from '@goodboy/ui/icons';
import { BitbucketIcon, GithubIcon, GitlabIcon } from '@goodboy/ui';

type Host = 'github' | 'gitlab' | 'bitbucket' | 'local';

type Params = {
  readonly host: Host;
};

const HOST_ICON: Readonly<Record<Host, IconGlyph>> = {
  github: GithubIcon,
  gitlab: GitlabIcon,
  bitbucket: BitbucketIcon,
  local: SquareArrowOutUpRight,
};

export const hostIconOf = ({ host }: Params): IconGlyph => HOST_ICON[host];
