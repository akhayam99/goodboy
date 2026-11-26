import { WORKSPACE_TOOL_KINDS, type WorkspaceToolKind } from '../../store/slices/drawer/state';

type Params = {
  readonly key: string;
};

export const toolKindOf = ({ key }: Params): WorkspaceToolKind | undefined =>
  WORKSPACE_TOOL_KINDS.find((known) => known === key);
