export type RoleLibraryGroup =
  'Engineering' | 'Data and AI' | 'Lead' | 'Product and design' | 'Other';

export type RoleLibraryEntry = Readonly<{
  id: string;
  label: string;
  group: RoleLibraryGroup;
  aliases: ReadonlyArray<string>;
}>;

export const ROLE_LIBRARY_GROUPS = [
  'Engineering',
  'Data and AI',
  'Lead',
  'Product and design',
  'Other',
] satisfies ReadonlyArray<RoleLibraryGroup>;

export const ROLE_LIBRARY = [
  {
    id: 'software-engineer',
    label: 'Software Engineer',
    group: 'Engineering',
    aliases: ['swe', 'developer', 'programmer'],
  },
  {
    id: 'frontend-engineer',
    label: 'Frontend Engineer',
    group: 'Engineering',
    aliases: ['fe', 'front-end', 'web'],
  },
  {
    id: 'backend-engineer',
    label: 'Backend Engineer',
    group: 'Engineering',
    aliases: ['be', 'back-end', 'server'],
  },
  {
    id: 'full-stack-engineer',
    label: 'Full-stack Engineer',
    group: 'Engineering',
    aliases: ['fullstack', 'full stack'],
  },
  {
    id: 'mobile-engineer',
    label: 'Mobile Engineer',
    group: 'Engineering',
    aliases: ['ios', 'android'],
  },
  {
    id: 'platform-engineer',
    label: 'Platform Engineer',
    group: 'Engineering',
    aliases: ['infra', 'infrastructure'],
  },
  { id: 'devops-engineer', label: 'DevOps Engineer', group: 'Engineering', aliases: ['ops', 'ci'] },
  {
    id: 'site-reliability-engineer',
    label: 'Site Reliability Engineer',
    group: 'Engineering',
    aliases: ['sre', 'reliability'],
  },
  {
    id: 'security-engineer',
    label: 'Security Engineer',
    group: 'Engineering',
    aliases: ['appsec', 'secops'],
  },
  {
    id: 'embedded-engineer',
    label: 'Embedded Engineer',
    group: 'Engineering',
    aliases: ['firmware', 'hardware'],
  },
  {
    id: 'qa-engineer',
    label: 'QA Engineer',
    group: 'Engineering',
    aliases: ['qa', 'test', 'quality'],
  },
  {
    id: 'game-developer',
    label: 'Game Developer',
    group: 'Engineering',
    aliases: ['gamedev', 'games'],
  },
  {
    id: 'data-engineer',
    label: 'Data Engineer',
    group: 'Data and AI',
    aliases: ['de', 'etl', 'pipelines'],
  },
  {
    id: 'analytics-engineer',
    label: 'Analytics Engineer',
    group: 'Data and AI',
    aliases: ['dbt', 'analytics'],
  },
  {
    id: 'data-scientist',
    label: 'Data Scientist',
    group: 'Data and AI',
    aliases: ['ds', 'statistics'],
  },
  { id: 'data-analyst', label: 'Data Analyst', group: 'Data and AI', aliases: ['bi', 'analyst'] },
  {
    id: 'ml-engineer',
    label: 'ML Engineer',
    group: 'Data and AI',
    aliases: ['mle', 'machine learning'],
  },
  { id: 'ai-engineer', label: 'AI Engineer', group: 'Data and AI', aliases: ['llm', 'genai'] },
  { id: 'tech-lead', label: 'Tech Lead', group: 'Lead', aliases: ['tl', 'lead'] },
  {
    id: 'staff-engineer',
    label: 'Staff Engineer',
    group: 'Lead',
    aliases: ['principal', 'senior'],
  },
  {
    id: 'engineering-manager',
    label: 'Engineering Manager',
    group: 'Lead',
    aliases: ['em', 'manager'],
  },
  {
    id: 'cto',
    label: 'CTO',
    group: 'Lead',
    aliases: ['chief technology officer', 'vp engineering'],
  },
  {
    id: 'product-manager',
    label: 'Product Manager',
    group: 'Product and design',
    aliases: ['pm', 'product owner', 'po'],
  },
  {
    id: 'product-designer',
    label: 'Product Designer',
    group: 'Product and design',
    aliases: ['designer', 'ux', 'ui'],
  },
  {
    id: 'design-engineer',
    label: 'Design Engineer',
    group: 'Product and design',
    aliases: ['ux engineer', 'prototyping'],
  },
  {
    id: 'ux-researcher',
    label: 'UX Researcher',
    group: 'Product and design',
    aliases: ['research', 'user research'],
  },
  {
    id: 'technical-writer',
    label: 'Technical Writer',
    group: 'Other',
    aliases: ['docs', 'writer', 'documentation'],
  },
  {
    id: 'developer-advocate',
    label: 'Developer Advocate',
    group: 'Other',
    aliases: ['devrel', 'advocate'],
  },
  { id: 'founder', label: 'Founder', group: 'Other', aliases: ['ceo', 'cofounder', 'co-founder'] },
  { id: 'consultant', label: 'Consultant', group: 'Other', aliases: ['contractor', 'freelancer'] },
  { id: 'student', label: 'Student', group: 'Other', aliases: ['learner', 'intern'] },
] satisfies ReadonlyArray<RoleLibraryEntry>;
