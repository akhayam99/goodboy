import { CircleAlert, TriangleAlert } from '@goodboy/ui/icons';
import { ICON_SIZE, cn, tintClasses } from '@goodboy/ui';
import type { ConnectionState } from '../../model/connectionState';

type Props = {
  readonly state: ConnectionState;
};

export const StateWord = ({ state }: Props) => {
  if (state.tone === null) {
    return (
      <span data-connection-word="" className="shrink-0 text-meta text-muted-foreground">
        {state.word}
      </span>
    );
  }
  const Icon = state.tone === 'danger' ? CircleAlert : TriangleAlert;
  return (
    <span
      data-connection-word=""
      data-tone={state.tone}
      className={cn('flex shrink-0 items-center gap-1 text-meta', tintClasses(state.tone).text)}
    >
      <Icon size={ICON_SIZE.row} aria-hidden />
      {state.word}
    </span>
  );
};
