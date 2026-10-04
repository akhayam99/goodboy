import { useEffect, useState } from 'react';
import { Undo2 } from 'lucide-react';
import type { WorkflowRules, WorkspaceId } from '@goodboy/types';
import { Band, cn } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { PromptField } from '../../../../shared/components/PromptField';
import { usePolishGuidance } from '../../hooks/usePolishGuidance';
import { AlsoSentLine } from '../WorkflowGuidance/AlsoSentLine';
import { GuidanceRecipients } from '../WorkflowGuidance/GuidanceRecipients';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly rules: WorkflowRules;
  readonly onChange: (patch: Partial<WorkflowRules>) => void;
};

const TOOL_CLASS =
  'inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-meta text-muted-foreground transition-colors hover:bg-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50';

export const RulesGuidanceBand = ({ workspaceId, rules, onChange }: Props) => {
  const [draft, setDraft] = useState(rules.standingGuidance);
  const [undo, setUndo] = useState<string | null>(null);
  const { polish, isPolishing } = usePolishGuidance({ workspaceId });

  useEffect(() => {
    setDraft(rules.standingGuidance);
  }, [rules.standingGuidance]);

  const save = (text: string) => {
    if (text !== rules.standingGuidance) {
      onChange({ standingGuidance: text });
    }
  };

  const onPolish = async () => {
    const polished = await polish(draft);
    if (polished === null || polished === draft) {
      return;
    }
    setUndo(draft);
    setDraft(polished);
    onChange({ standingGuidance: polished });
  };

  const isEmpty = rules.standingGuidance.trim() === '';
  return (
    <Band label="Guidance" ariaLabel="Guidance" headingLevel={3} inset="content">
      <PromptField
        kind="document"
        label="Guidance"
        value={draft}
        onChange={setDraft}
        onBlur={() => save(draft)}
        onSubmit={() => save(draft)}
        keyLabels={{ send: 'saves' }}
        placeholder="One rule per line"
        disabled={isPolishing}
        hasPreview
        minRows={3}
        maxRows={10}
        actions={
          <div className="flex shrink-0 items-center gap-1">
            {undo === null ? null : (
              <button
                type="button"
                className={TOOL_CLASS}
                aria-label="Undo guidance change"
                onClick={() => {
                  setDraft(undo);
                  onChange({ standingGuidance: undo });
                  setUndo(null);
                }}
              >
                <Undo2 size={ICON_SIZE.row} aria-hidden /> Undo
              </button>
            )}
            <button
              type="button"
              className={TOOL_CLASS}
              aria-label="Polish guidance"
              disabled={isPolishing || draft.trim() === ''}
              onClick={() => void onPolish()}
            >
              <CONCEPT_ICONS.enhance size={ICON_SIZE.row} aria-hidden />
              <span className={cn(isPolishing && 'text-shimmer')}>Polish</span>
            </button>
          </div>
        }
      />
      {isEmpty ? null : (
        <GuidanceRecipients
          roles={rules.guidanceRoles}
          lead="Goes to the planning agent and to"
          footer={<AlsoSentLine />}
          onRoles={(guidanceRoles) => onChange({ guidanceRoles })}
        />
      )}
    </Band>
  );
};
