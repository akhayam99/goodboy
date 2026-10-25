import { Button, ICON_SIZE } from '@goodboy/ui';

import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly canAsk: boolean;
  readonly askLabel: string;
  readonly hasOutput: boolean;
  readonly onAsk: () => void;
};

export const AskOutputButton = ({ canAsk, askLabel, hasOutput, onAsk }: Props) => {
  if (!canAsk) {
    return null;
  }
  return (
    <Button variant="ghost" size="sm" disabled={!hasOutput} onClick={onAsk}>
      <CONCEPT_ICONS.agents size={ICON_SIZE.row} aria-hidden />
      {askLabel}
    </Button>
  );
};
