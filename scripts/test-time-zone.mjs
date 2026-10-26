import { fileURLToPath } from 'node:url';

const MAX_EAST_HOURS = 14;
const HOURS_PER_DAY = 24;
const LOCAL_HOUR_BY_NAME = { 'before-midnight': 23, 'after-midnight': 0 };

export const offsetHoursFor = ({ utcHour, localHour }) => {
  const east = (localHour - utcHour + HOURS_PER_DAY) % HOURS_PER_DAY;
  return east > MAX_EAST_HOURS ? east - HOURS_PER_DAY : east;
};

export const posixZoneFor = ({ offsetHours }) =>
  offsetHours >= 0 ? `XXX-${offsetHours}` : `XXX+${-offsetHours}`;

export const timeZoneFor = ({ name, utcHour }) => {
  const localHour = LOCAL_HOUR_BY_NAME[name];
  if (localHour === undefined) {
    return name;
  }
  return posixZoneFor({ offsetHours: offsetHoursFor({ utcHour, localHour }) });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const name = process.argv[2];
  if (name === undefined || name === '') {
    console.error(
      'usage: node scripts/test-time-zone.mjs <zone | before-midnight | after-midnight>',
    );
    process.exit(1);
  }
  console.log(timeZoneFor({ name, utcHour: new Date().getUTCHours() }));
}
