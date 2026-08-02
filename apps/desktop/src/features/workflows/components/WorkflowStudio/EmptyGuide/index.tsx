import { Plus } from 'lucide-react';
import { Button, EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly onNew: () => void;
  readonly hasPresets: boolean;
};

const RETURNING_DESCRIPTION =
  "A workflow chains several agents into one saved sequence, each step's output feeding the next. Pick a preset on the left to clone or edit, or start a new one and drag its steps in from the Step Library on the right.";

const FIRST_RUN_DESCRIPTION =
  "A workflow chains several agents into one saved sequence, each step's output feeding the next. Start one and drag its steps in from the Step Library on the right, then it joins the preset list on the left.";

export const EmptyGuide = ({ onNew, hasPresets }: Props) => {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <EmptyState
        icon={CONCEPT_ICONS.workflows}
        tone={CONCEPT_TONE.workflows}
        title={hasPresets ? 'Build a workflow' : 'Design your first workflow'}
        description={hasPresets ? RETURNING_DESCRIPTION : FIRST_RUN_DESCRIPTION}
        action={
          <div className="flex flex-col items-center gap-2">
            <Button size="sm" onClick={onNew}>
              <Plus size={13} aria-hidden />
              New workflow
            </Button>
            <span className="text-2xs text-muted-foreground/70">
              Save it once, then run it on any session from Start a workflow.
            </span>
          </div>
        }
        size="lg"
        headingLevel={2}
        className="max-w-md"
      />
    </div>
  );
};
