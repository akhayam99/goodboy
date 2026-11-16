import { TASKS } from '@goodboy/core/settings';

export const MODELS_PAGE_SECTION = 'models';

type Params = {
  readonly section?: string;
};

export const isModelsPage = ({ section }: Params): boolean =>
  section === MODELS_PAGE_SECTION || TASKS.some((task) => task.id === section);
