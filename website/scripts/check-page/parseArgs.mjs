import { resolve } from 'node:path';

const DEFAULT_URLS = [
  'http://localhost:1499/',
  'http://localhost:1499/features',
  'http://localhost:1499/docs',
  'http://localhost:1499/docs/providers',
  'http://localhost:1499/changelog',
  'http://localhost:1499/404',
];

export const parseArgs = ({ argv }) => {
  const shotsIndex = argv.indexOf('--shots');
  const shots = shotsIndex === -1 ? null : resolve(argv[shotsIndex + 1]);
  const positional = argv.filter(
    (value, index) => !value.startsWith('--') && argv[index - 1] !== '--shots',
  );
  return {
    urls: positional.length > 0 ? positional : DEFAULT_URLS,
    shots,
    isVerifyingIcons: argv.includes('--verify-icons'),
  };
};
