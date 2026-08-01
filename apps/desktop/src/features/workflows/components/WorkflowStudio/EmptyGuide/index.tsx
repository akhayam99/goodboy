import { Plus } from 'lucide-react';
import { Button, EmptyState } from '@goodboy/ui';
import { SECTION_ICONS } from '../../../../../shared/components/section-icons';

type Props = {
  readonly onNew: () => void;
  readonly hasPresets: boolean;
};

export const EmptyGuide = ({ onNew, hasPresets }: Props) => {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <EmptyState
        icon={SECTION_ICONS.workflows}
        title={hasPresets ? 'Build a workflow' : 'Design your first workflow'}
        description="A workflow chains several agents into one saved sequence, each step's output feeding the next. Save it once, run it on any session."
        action={
          <Button size="sm" onClick={onNew}>
            <Plus size={13} aria-hidden />
            New workflow
          </Button>
        }
        size="lg"
        headingLevel={2}
        className="max-w-md"
      />
    </div>
  );
};
