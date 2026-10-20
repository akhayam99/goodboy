import type { ComponentProps, ReactNode } from 'react';
import type { FactCard } from '@goodboy/ui';

export type CardTrigger = ComponentProps<typeof FactCard>['children'];

type CardWrapParams = {
  readonly children: CardTrigger;
  readonly isOpen?: boolean;
};

export type CardWrap = (params: CardWrapParams) => ReactNode;

export type TimelineRowIdentity = {
  readonly roleLabel: string | null;
  readonly summary: string | null;
  readonly hasGlyph: boolean;
  readonly wrapCard: CardWrap;
};
