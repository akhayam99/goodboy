import { PROFILE_ACCESS, type ProfileAudience, type ProfileField } from '@goodboy/core';
import type { WorkspaceProfile } from '@goodboy/types';

type GuardParams = {
  readonly profile: WorkspaceProfile | undefined;
  readonly audience: ProfileAudience;
};

type LineParams = {
  readonly profile: WorkspaceProfile;
  readonly field: ProfileField;
};

const joinLabels = ({ labels }: { readonly labels: ReadonlyArray<string> }): string =>
  labels
    .map((label) => label.trim())
    .filter((label) => label !== '')
    .join(', ');

const fieldLine = ({ profile, field }: LineParams): string => {
  if (field === 'roles') {
    const roles = joinLabels({ labels: profile.roles });
    return roles === '' ? '' : `Their roles: ${roles}`;
  }
  if (field === 'aboutWork') {
    const aboutWork = profile.aboutWork?.trim() ?? '';
    return aboutWork === '' ? '' : `About their work:\n${aboutWork}`;
  }
  if (field === 'workingRules') {
    const workingRules = profile.workingRules?.trim() ?? '';
    return workingRules === '' ? '' : `How they want agents to work with them:\n${workingRules}`;
  }
  if (field === 'explainMore') {
    const topics = joinLabels({ labels: profile.explainMore });
    return topics === '' ? '' : `Explain more when the work touches: ${topics}`;
  }
  const exhaustive: never = field;
  return exhaustive;
};

export const buildProfileGuard = ({ profile, audience }: GuardParams): string => {
  if (profile === undefined) {
    return '';
  }
  const lines = PROFILE_ACCESS[audience]
    .map((field) => fieldLine({ profile, field }))
    .filter((line) => line !== '');
  if (lines.length === 0) {
    return '';
  }
  return ['[user-profile]', 'The person you are working with:', ...lines, '[/user-profile]'].join(
    '\n',
  );
};
