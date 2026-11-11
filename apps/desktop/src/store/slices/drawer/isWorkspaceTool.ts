import type { DrawerContent } from './state';

type Params = {
  readonly content: DrawerContent;
};

export const isWorkspaceTool = ({ content }: Params): boolean =>
  content.kind === 'terminal' || content.kind === 'browser';
