import type { WorkspaceToolKind } from '../../store/slices/drawer/state';

type Params = {
  readonly key: string;
};

const TOOL_KINDS: ReadonlyArray<WorkspaceToolKind> = ['terminal', 'browser', 'monitoring'];

export const toolKindOf = ({ key }: Params): WorkspaceToolKind | undefined =>
  TOOL_KINDS.find((known) => known === key);
