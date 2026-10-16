import type { SessionId } from '@goodboy/types';
import type { NewDrawerForm } from '../../../store/slices/drawer/state';
import { NEW_DRAWER_FORMS } from '../../session/newDrawerForms';
import type {
  ActionDefinition,
  ActionEnv,
  NewFormActionTarget,
  ObjectKindDefinition,
} from '../types';

export type NewFormFacts = {
  readonly sessionId: SessionId;
  readonly isAutoOn: boolean;
};

const MENU_FORMS: ReadonlyArray<NewDrawerForm> = [
  'run',
  'orchestrate',
  'agent',
  'auto',
  'report',
  'wireframe',
];

type OpenParams = {
  readonly env: ActionEnv;
  readonly sessionId: SessionId;
  readonly form: NewDrawerForm;
};

const openForm = ({ env, sessionId, form }: OpenParams): void => {
  const state = env.getState();
  if (form === 'report' || form === 'wireframe') {
    state.openArtifactCreation({ sessionId, kind: form, workflowRunId: null });
    return;
  }
  state.openDrawer({ kind: 'new', sessionId, payload: { form } });
};

type FormParams = {
  readonly form: NewDrawerForm;
};

const formAction = ({ form }: FormParams): ActionDefinition<NewFormFacts> => ({
  id: `newForm.${form}`,
  label: NEW_DRAWER_FORMS[form].title,
  icon: NEW_DRAWER_FORMS[form].icon,
  group: 'act',
  when: ({ facts }) => facts.isAutoOn || !NEW_DRAWER_FORMS[form].isAutoOnly,
  run: ({ facts, env }) => openForm({ env, sessionId: facts.sessionId, form }),
});

export const NEW_FORM_KIND: ObjectKindDefinition<NewFormActionTarget, NewFormFacts> = {
  noun: 'new',
  facts: ({ target }) => target.facts,
  actions: MENU_FORMS.map((form) => formAction({ form })),
};
