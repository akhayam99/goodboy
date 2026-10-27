import { shellSplitOf } from './figures.mjs';

const FEATURE_PREFIX = 'features/';
const THEMES = ['dark', 'light'];

export const reshootPlanOf = ({ figures, area, theme }) => {
  if (theme !== undefined && !THEMES.includes(theme)) {
    throw new Error(`--theme is dark or light, got "${theme}"`);
  }
  const steps = [];
  const skipped = [];
  for (const [key, { recipe }] of Object.entries(figures)) {
    if (!key.startsWith(FEATURE_PREFIX)) {
      continue;
    }
    const name = key.slice(FEATURE_PREFIX.length);
    if (area !== undefined && name !== area && !name.startsWith(`${area}-`)) {
      continue;
    }
    if (recipe === undefined || recipe === '') {
      skipped.push(key);
      continue;
    }
    const themeArguments = theme === undefined ? [] : ['--themes', theme];
    steps.push({
      key,
      name,
      args: ['--out', name, ...shellSplitOf({ value: recipe }), ...themeArguments],
    });
  }
  return { steps, skipped };
};

export const includesHeroOf = ({ figures, area, theme }) =>
  figures['readme/readme-hero'] !== undefined &&
  theme === undefined &&
  (area === undefined || area === 'readme');
