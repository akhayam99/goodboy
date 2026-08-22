export type ProfileDiscipline = {
  readonly value: string;
  readonly label: string;
};

export const PROFILE_DISCIPLINES: ReadonlyArray<ProfileDiscipline> = [
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'fullstack', label: 'Fullstack' },
  { value: 'platform', label: 'Platform' },
  { value: 'data', label: 'Data' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'pm', label: 'Product' },
  { value: 'design', label: 'Design' },
  { value: 'other', label: 'Other' },
];
