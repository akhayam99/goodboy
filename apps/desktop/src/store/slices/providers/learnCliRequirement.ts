import { catalogModelForId, type CliRequirement } from '@goodboy/core';
import { setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { CLI_LABEL } from '../../../features/providers/cliLabel';
import { SETTING_CLI_REQUIREMENTS } from './cliRequirementsSetting';
import type { GetFn, SetFn } from './types';

export type LearnCliRequirementParams = CliRequirement & {
  readonly installedVersion: string;
};

export const learnCliRequirement = (set: SetFn, get: GetFn) => {
  return async ({
    providerId,
    modelKey,
    requiredVersion,
    installedVersion,
  }: LearnCliRequirementParams): Promise<void> => {
    const current = get().cliRequirements;
    const isKnown = current.some(
      (entry) =>
        entry.providerId === providerId &&
        entry.modelKey === modelKey &&
        entry.requiredVersion === requiredVersion,
    );
    if (isKnown) {
      return;
    }
    const next = [
      ...current.filter(
        (entry) => !(entry.providerId === providerId && entry.modelKey === modelKey),
      ),
      { providerId, modelKey, requiredVersion },
    ];
    set({ cliRequirements: next });
    await setSetting(tauriDatabase, SETTING_CLI_REQUIREMENTS, JSON.stringify(next)).catch(
      () => undefined,
    );
    const modelLabel =
      catalogModelForId({ provider: providerId, modelId: modelKey })?.label ?? modelKey;
    const cli = CLI_LABEL[providerId];
    await get()
      .emitNotification({
        kind: 'provider-cli-outdated',
        severity: 'warning',
        title: `${modelLabel} needs a newer ${cli}`,
        body: `You have ${cli} ${installedVersion}. ${modelLabel} needs ${requiredVersion} or newer.`,
        action: { kind: 'update-provider-cli', providerId },
        coalesceKey: `provider-cli-outdated:${providerId}`,
      })
      .catch(() => undefined);
  };
};
