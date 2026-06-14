import { MousePointerClick, Sparkles } from 'lucide-react';
import { EmptyState } from '@goodboy/ui';

type Props = {
  hasAnySession: boolean;
};

export const SidebarDetailHint = ({ hasAnySession }: Props) => {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={hasAnySession ? MousePointerClick : Sparkles}
        title={hasAnySession ? 'No session selected' : 'No sessions yet'}
        description={
          hasAnySession
            ? 'Pick a session from the list to the left.'
            : 'Create your first session from the list to the left.'
        }
      />
    </div>
  );
};
