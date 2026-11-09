import { DEMO_LINKS } from './demoLinks';
import type { DemoTheme } from './director/demoProtocol';

type Params = {
  readonly theme: DemoTheme;
};

export const downloadHrefOf = ({ theme }: Params): string =>
  `${DEMO_LINKS.site}/?theme=${theme}#install`;
