import type { ReactNode } from 'react';
import type { DrawerRequest } from './state';

type DrawerKind = DrawerRequest['kind'];

type DrawerRenderParams<Kind extends DrawerKind> = {
  readonly drawer: Extract<DrawerRequest, { readonly kind: Kind }>;
  readonly closeDrawer: () => void;
  readonly openDrawer: (request: DrawerRequest) => void;
};

export type DrawerRegistration<Kind extends DrawerKind> = {
  readonly kind: Kind;
  readonly render: (params: DrawerRenderParams<Kind>) => ReactNode;
};
