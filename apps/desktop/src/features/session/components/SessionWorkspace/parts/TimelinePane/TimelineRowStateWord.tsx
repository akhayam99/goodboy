import { Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import type { StatePresentation } from '../../../../../workTreeModel/statePresentation';

type Props = {
  readonly shown: StatePresentation;
};

export const TimelineRowStateWord = ({ shown }: Props) => {
  if (shown.icon === null && shown.short === shown.word) {
    return <span className="truncate">{shown.word}</span>;
  }
  if (shown.icon === null) {
    return (
      <>
        <span className="sr-only">{shown.word}</span>
        <span aria-hidden className="truncate">
          {shown.short}
        </span>
      </>
    );
  }
  const Icon = shown.icon;
  return (
    <Tooltip content={shown.word}>
      <span
        role="img"
        aria-label={shown.word}
        data-state-icon={shown.word}
        className="inline-flex size-5 items-center justify-center"
      >
        <Icon size={ICON_SIZE.control} aria-hidden />
      </span>
    </Tooltip>
  );
};
