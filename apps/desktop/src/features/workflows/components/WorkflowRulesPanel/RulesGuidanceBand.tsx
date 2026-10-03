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
  'inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-secondary text-muted-foreground transition-colors hover:bg-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50';

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
    <Band
      label="Standing guidance"
      ariaLabel="Standing guidance"
      headingLevel={2}
      hint="Every run starts with it"
      inset="content"
    >
      <PromptField
        kind="document"
        label="Standing guidance"
        value={draft}
        onChange={setDraft}
        onBlur={() => save(draft)}
        onSubmit={() => save(draft)}
        keyLabels={{ send: 'saves' }}
        placeholder="Rules every run should respect, one per line."
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
      {isEmpty ? (
        <p className="text-secondary text-faint-foreground">
          Nothing to send yet. Add a rule above and it goes to every new run.
        </p>
      ) : (
        <>
          <GuidanceRecipients
            roles={rules.guidanceRoles}
            where="in Custom and Preset runs"
            onRoles={(guidanceRoles) => onChange({ guidanceRoles })}
          />
          <p className="text-secondary text-faint-foreground">
            Orchestrated runs send it to the orchestrator.
          </p>
        </>
      )}
      <AlsoSentLine />
    </Band>
  );
};
