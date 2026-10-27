import { Button, Notice } from '@goodboy/ui';
import type { EndedServices } from '../../hooks/useServiceStarts';

type Props = EndedServices;

export const EndedServicesRow = ({ count, onStart, onDismiss }: Props) => (
  <Notice
    tone="info"
    placement="inline"
    role="status"
    title={`Start the ${count === 1 ? 'service' : `${count} services`} that ${count === 1 ? 'was' : 'were'} running`}
    actions={
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onStart}>
          Start
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    }
  />
);
