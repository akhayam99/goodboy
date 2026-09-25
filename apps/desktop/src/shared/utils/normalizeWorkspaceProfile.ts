import type { WorkspaceProfile } from '@goodboy/types';

type Params = {
  readonly profile: WorkspaceProfile | undefined;
};

const uniqueLabels = ({ labels }: { readonly labels: ReadonlyArray<string> }) => {
  const seen = new Set<string>();
  return labels
    .map((label) => label.replace(/\s+/g, ' ').trim())
    .filter((label) => {
      const key = label.toLowerCase();
      if (label === '' || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

const textOrNull = ({ text }: { readonly text: string | null }): string | null => {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
};

export const normalizeWorkspaceProfile = ({ profile }: Params): WorkspaceProfile => ({
  roles: uniqueLabels({ labels: profile?.roles ?? [] }),
  aboutWork: textOrNull({ text: profile?.aboutWork ?? null }),
  workingRules: textOrNull({ text: profile?.workingRules ?? null }),
  explainMore: uniqueLabels({ labels: profile?.explainMore ?? [] }),
});
