import { Button, Notice, ScrollFade, SkeletonText } from '@goodboy/ui';
import type { ChangeFile } from '../../../../../file-versions/changeTurnsOf';
import type { ChangeSidesView } from '../../../../../file-versions/useChangeSides';
import { TextChanges } from './TextChanges';
import { QuietChange } from './QuietChange';
import { CHANGE_FRAME } from './changeFrame';

type Props = {
  readonly file: ChangeFile;
  readonly turnNumber: number;
  readonly view: ChangeSidesView;
  readonly isCode: boolean;
};

export const ChangeBody = ({ file, turnNumber, view, isCode }: Props) => {
  const { sides, retry } = view;
  if (file.restoreRunId !== null) {
    return (
      <QuietChange
        text={
          file.change === 'added'
            ? 'This new file was removed from the folder. Undo restore puts it back.'
            : `This file is back to its text from before turn ${turnNumber}. Nothing differs from that version.`
        }
      />
    );
  }
  if (sides.status === 'loading') {
    return (
      <div className={CHANGE_FRAME}>
        <SkeletonText lines={6} className="p-6" />
      </div>
    );
  }
  if (sides.status === 'failed') {
    return (
      <Notice
        tone="danger"
        placement="inline"
        role="alert"
        title={`Couldn't show the changes to ${file.label}`}
        body="The saved versions are still there."
        detail={sides.message}
        actions={
          <Button variant="secondary" size="xs" onClick={retry}>
            Retry
          </Button>
        }
      />
    );
  }
  if (sides.status === 'binary') {
    return (
      <QuietChange text="This file changed, but it can't be shown as text. Open it to see it." />
    );
  }
  if (sides.status === 'tooLarge') {
    return <QuietChange text="This file is too large to show here. Open it to see it." />;
  }
  if (sides.status === 'unavailable') {
    return <QuietChange text="The saved version of this file is no longer kept." />;
  }
  if (sides.changes.rows.length === 0) {
    return <QuietChange text="No line changed. Only the file itself was touched." />;
  }
  return (
    <div className={CHANGE_FRAME}>
      <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
        <TextChanges changes={sides.changes} isCode={isCode} />
      </ScrollFade>
    </div>
  );
};
