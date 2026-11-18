export type ShellColumnScope = 'workspace' | 'app';

export type ShellArrangement = {
  readonly columnScope: ShellColumnScope;
};

type ShellArrangementParams = {
  readonly hasWorkspace: boolean;
};

export const shellArrangement = ({ hasWorkspace }: ShellArrangementParams): ShellArrangement => ({
  columnScope: hasWorkspace ? 'workspace' : 'app',
});
