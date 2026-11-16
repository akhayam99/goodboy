import { Button } from '@goodboy/ui';
import { openConnection } from '../../../../connections/openConnection';
import { NAMES } from '../../../../../shared/utils/names';

export const ConnectionsPointer = () => (
  <div className="flex min-w-0 items-center justify-between gap-3">
    <p className="min-w-0 text-meta text-muted-foreground">
      {`Accounts, usage and which models show in the picker live in ${NAMES.connections}.`}
    </p>
    <Button variant="ghost" size="sm" onClick={() => openConnection({ focus: null })}>
      {`Open ${NAMES.connections}`}
    </Button>
  </div>
);
