import { CommandError } from '../../shared/lib/invokeCommand';
import type { ExploreOpenAction } from './openAction';

type Params = {
  readonly name: string;
  readonly action: ExploreOpenAction;
  readonly isReveal: boolean;
  readonly error: unknown;
};

export type ExploreOpenFailure = {
  readonly message: string;
  readonly isEditorMissing: boolean;
};

const reasonOf = ({ error }: { readonly error: unknown }): string => {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return 'Unknown error';
};

export const openFailureOf = ({ name, action, isReveal, error }: Params): ExploreOpenFailure => {
  const reason = reasonOf({ error });
  if (isReveal) {
    return {
      message: `Couldn't show ${name} in the file manager. ${reason}`,
      isEditorMissing: false,
    };
  }
  const target = action.editor === null ? '' : ` in ${action.editor.label}`;
  return {
    message: `Couldn't open ${name}${target}. ${reason}`,
    isEditorMissing:
      action.editor !== null && error instanceof CommandError && error.kind === 'editor_missing',
  };
};
