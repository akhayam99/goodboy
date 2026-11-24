import { Tooltip, cn, tintClasses } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import type { RowState } from '../../../workTreeModel/rowState';
import { statePresentationOf } from '../../../workTreeModel/statePresentation';
import { isNotFinishedNote } from './isNotFinishedNote';

type Props = {
  readonly state: RowState;
};

export const RunTreeStepState = ({ state }: Props) => {
  if (state.phase === 'running') {
    return <span className="text-info">{NAMES.running}</span>;
  }
  if (state.phase === 'queued') {
    return <span className="text-faint-foreground">{NAMES.queued}</span>;
  }
  const shown = isNotFinishedNote({ state }) ? statePresentationOf({ state }) : null;
  if (shown === null) {
    return null;
  }
  const className = cn('truncate', tintClasses(shown.tone).text);
  return (
    <span data-step-tone={shown.tone} className="flex min-w-0 justify-end">
      {shown.short === shown.word ? (
        <span className={className}>{shown.word}</span>
      ) : (
        <>
          <span className="sr-only">{shown.word}</span>
          <Tooltip content={shown.word}>
            <span aria-hidden className={className}>
              {shown.short}
            </span>
          </Tooltip>
        </>
      )}
    </span>
  );
};
