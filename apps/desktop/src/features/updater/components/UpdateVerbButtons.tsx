import { Button } from '@goodboy/ui';
import type { UpdateVerb } from '../hooks/useUpdateCard';

type Props = {
  readonly verbs: ReadonlyArray<UpdateVerb>;
};

export const UpdateVerbButtons = ({ verbs }: Props) => (
  <>
    {verbs.map((verb) => (
      <Button
        key={verb.id}
        variant={verb.variant}
        size="sm"
        isBusy={verb.isBusy}
        busyLabel={verb.busyLabel}
        onClick={verb.run}
      >
        {verb.label}
      </Button>
    ))}
  </>
);
