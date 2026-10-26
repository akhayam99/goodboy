import { Button, ChoiceCards, ICON_SIZE, SectionHeader, type ChoiceCardOption } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import type { StartShape } from '../../../../store/slices/sessionDraft/state';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { START_KIND_COPY } from '../../startKind/startKindCopy';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly isDisabled?: boolean;
};

type PickedKind = 'workflow' | 'agent';

const KIND_ORDER: ReadonlyArray<PickedKind> = ['workflow', 'agent'];

const kindOptions = (): ReadonlyArray<ChoiceCardOption<PickedKind>> =>
  KIND_ORDER.map((value) => {
    const card = START_KIND_COPY.kinds[value];
    return {
      value,
      label: card.label,
      icon: card.icon,
      hint: card.what,
      facts: [{ label: START_KIND_COPY.example, text: card.example }],
    };
  });

type ShapeParams = {
  readonly kind: PickedKind;
};

const shapeOptions = ({ kind }: ShapeParams): ReadonlyArray<ChoiceCardOption<StartShape>> =>
  START_KIND_COPY.shapesOfKind[kind].map((value) => {
    const card = START_KIND_COPY.shapes[value];
    return {
      value,
      label: card.label,
      icon: card.icon,
      hint: card.what,
      facts: [{ label: START_KIND_COPY.example, text: card.example }],
    };
  });

export const StartKindChoice = ({ workspaceId, isDisabled = false }: Props) => {
  const startKind = useAppStore((state) => selectSessionDraft({ state, workspaceId }).startKind);
  const startShape = useAppStore((state) => selectSessionDraft({ state, workspaceId }).startShape);
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const kind = startKind === 'workflow' || startKind === 'agent' ? startKind : null;
  const RouteIcon = CONCEPT_ICONS.autoRouting;

  const pickKind = (next: PickedKind): void => {
    if (isDisabled || next === kind) {
      return;
    }
    patchSessionDraft({
      workspaceId,
      patch: { startKind: next, startShape: null, hasChosenStart: true },
    });
  };

  const pickShape = (next: StartShape): void => {
    if (isDisabled) {
      return;
    }
    patchSessionDraft({ workspaceId, patch: { startShape: next, hasChosenStart: true } });
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-label={START_KIND_COPY.question} className="flex flex-col gap-2">
        <SectionHeader label={START_KIND_COPY.question} headingLevel={2} />
        <ChoiceCards
          ariaLabel={START_KIND_COPY.question}
          className="sm:grid-cols-2"
          isHintWrapped
          value={kind}
          onChange={pickKind}
          options={kindOptions()}
        />
        {kind === null ? (
          <div className="flex">
            <Button
              variant="ghost"
              size="sm"
              disabled={isDisabled}
              onClick={() =>
                patchSessionDraft({
                  workspaceId,
                  patch: { startKind: 'auto', startShape: null, hasChosenStart: true },
                })
              }
            >
              <RouteIcon size={ICON_SIZE.row} aria-hidden />
              {START_KIND_COPY.notSure}
            </Button>
          </div>
        ) : null}
      </section>
      {kind === null ? null : (
        <section aria-label={START_KIND_COPY.subQuestion[kind]} className="flex flex-col gap-2">
          <SectionHeader label={START_KIND_COPY.subQuestion[kind]} headingLevel={2} />
          <ChoiceCards
            ariaLabel={START_KIND_COPY.subQuestion[kind]}
            className="sm:grid-cols-2"
            isHintWrapped
            value={startShape}
            onChange={pickShape}
            options={shapeOptions({ kind })}
          />
        </section>
      )}
    </div>
  );
};
