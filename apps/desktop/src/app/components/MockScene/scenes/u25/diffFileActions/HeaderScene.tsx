import { DiffView } from '../../../../../../features/diff/components/DiffView';
import type { DiffComments } from '../../../../../../features/diff/components/DiffView/types';
import { FILE, OLD_TEXT, WHOLE_TEXT } from './seed';

const COMMENTS: DiffComments = {
  threads: [],
  submitLabel: 'Add note',
  composerLabel: 'Note',
  allowFileLevel: true,
  onSubmit: () => undefined,
};

type Props = Record<never, never>;

export const HeaderScene = ({}: Props) => (
  <main className="flex min-w-0 flex-col gap-3 bg-background p-6 text-foreground">
    <DiffView
      files={[FILE]}
      presentation="inline"
      comments={COMMENTS}
      viewed={{ stateOf: () => 'none', onToggle: () => undefined }}
      fileActions={{ onOpenInEditor: () => undefined, onShowWhole: () => undefined }}
      loadFileSides={async () => ({ old: OLD_TEXT, new: WHOLE_TEXT, isTooLarge: false })}
    />
  </main>
);
