import { WORKSPACE_TOOL_KINDS, type DrawerContent } from './state';

type Params = {
  readonly content: DrawerContent;
};

export const isWorkspaceTool = ({ content }: Params): boolean =>
  WORKSPACE_TOOL_KINDS.some((kind) => kind === content.kind);
