import { brandId, type ProjectId } from '@goodboy/types';

export const STORY_PROJECTS = {
  payments: brandId<ProjectId>({ value: 'mock-settings-payments' }),
  ledger: brandId<ProjectId>({ value: 'mock-settings-ledger' }),
  relay: brandId<ProjectId>({ value: 'mock-settings-relay' }),
};
