import { fileURLToPath } from 'node:url';

const RELEASE_SUBJECT = /^chore\(repo\): release \d+\.\d+\.\d+(?: \(#\d+\))?$/;

export const shouldBuildDemo = ({ environment, message }) => {
  if (environment !== 'production') {
    return true;
  }
  const subject = (message ?? '').split('\n')[0].trim();
  return RELEASE_SUBJECT.test(subject);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const environment = process.env.VERCEL_ENV ?? '';
  const message = process.env.VERCEL_GIT_COMMIT_MESSAGE ?? '';
  const subject = message.split('\n')[0];
  if (shouldBuildDemo({ environment, message })) {
    console.log(`demo build: ${environment} "${subject}"`);
    process.exit(1);
  }
  console.log(`demo build skipped: ${environment} "${subject}" is not a release commit`);
  process.exit(0);
}
