import type { SessionId } from '@goodboy/types';
import type { NewDrawerForm } from '../../../store/slices/drawer/state';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NEW_DRAWER_FORMS } from '../../session/newDrawerForms';
import { openStartRun } from '../../session/startRun/openStartRun';
import { RUN_ROUTE_COPY } from '../../session/startRun/runRouteCopy';
import type {
  ActionDefinition,
  ActionEnv,
  NewFormActionTarget,
  ObjectKindDefinition,
} from '../types';

export type NewFormFacts = {
  readonly sessionId: SessionId;
};

const MENU_FORMS: ReadonlyArray<NewDrawerForm> = ['report', 'wireframe'];

type OpenParams = {
  readonly env: ActionEnv;
  readonly sessionId: SessionId;
  readonly form: NewDrawerForm;
};

const openForm = ({ env, sessionId, form }: OpenParams): void => {
  env.getState().openArtifactCreation({ sessionId, kind: form, workflowRunId: null });
};

type FormParams = {
  readonly form: NewDrawerForm;
};

const formAction = ({ form }: FormParams): ActionDefinition<NewFormFacts> => ({
  id: `newForm.${form}`,
  label: NEW_DRAWER_FORMS[form].title,
  icon: NEW_DRAWER_FORMS[form].icon,
  group: 'act',
  when: () => true,
  run: ({ facts, env }) => openForm({ env, sessionId: facts.sessionId, form }),
});

const START_RUN_ACTION: ActionDefinition<NewFormFacts> = {
  id: 'newForm.startRun',
  label: RUN_ROUTE_COPY.label,
  icon: CONCEPT_ICONS.workflows,
  group: 'act',
  when: () => true,
  run: ({ facts }) => openStartRun({ sessionId: facts.sessionId }),
};

export const NEW_FORM_KIND: ObjectKindDefinition<NewFormActionTarget, NewFormFacts> = {
  noun: 'new',
  facts: ({ target }) => target.facts,
  actions: [START_RUN_ACTION, ...MENU_FORMS.map((form) => formAction({ form }))],
};
