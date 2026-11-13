import type { IViewportRange } from '@xterm/xterm';
import type { WebLinksAddon } from '@xterm/addon-web-links';

type AddonOptions = NonNullable<ConstructorParameters<typeof WebLinksAddon>[1]>;

type RestParams = {
  readonly uri: string;
  readonly location: IViewportRange;
};

type Params = {
  readonly onRest: (params: RestParams) => void;
};

export const webLinkHoverOf =
  ({ onRest }: Params): NonNullable<AddonOptions['hover']> =>
  (_event, uri, location) =>
    onRest({ uri, location });
