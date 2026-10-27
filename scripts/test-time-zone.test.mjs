import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { offsetHoursFor, posixZoneFor, timeZoneFor } from './test-time-zone.mjs';

const localHourIn = ({ zone, at }) => {
  const original = process.env.TZ;
  process.env.TZ = zone;
  try {
    return new Date(at).getHours();
  } finally {
    if (original === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = original;
    }
  }
};

describe('offsetHoursFor', () => {
  it('moves east when the local hour is ahead of the UTC hour', () => {
    assert.equal(offsetHoursFor({ utcHour: 1, localHour: 4 }), 3);
  });

  it('moves west instead of going past +14', () => {
    assert.equal(offsetHoursFor({ utcHour: 1, localHour: 23 }), -2);
    assert.equal(offsetHoursFor({ utcHour: 23, localHour: 0 }), 1);
  });

  it('keeps every answer between -12 and +14', () => {
    for (let utcHour = 0; utcHour < 24; utcHour += 1) {
      for (const localHour of [0, 23]) {
        const offset = offsetHoursFor({ utcHour, localHour });
        assert.ok(offset >= -12 && offset <= 14, `${utcHour} ${localHour} gave ${offset}`);
      }
    }
  });
});

describe('posixZoneFor', () => {
  it('writes east of Greenwich with a minus, as POSIX does', () => {
    assert.equal(posixZoneFor({ offsetHours: 5 }), 'XXX-5');
    assert.equal(posixZoneFor({ offsetHours: -3 }), 'XXX+3');
    assert.equal(posixZoneFor({ offsetHours: 0 }), 'XXX-0');
  });
});

describe('timeZoneFor', () => {
  it('passes a named zone through', () => {
    assert.equal(timeZoneFor({ name: 'Pacific/Kiritimati', utcHour: 3 }), 'Pacific/Kiritimati');
  });

  it('puts the local clock in the hour before midnight and the hour after it', () => {
    const at = Date.UTC(2026, 9, 24, 1, 30);
    const before = timeZoneFor({ name: 'before-midnight', utcHour: 1 });
    const after = timeZoneFor({ name: 'after-midnight', utcHour: 1 });
    assert.equal(localHourIn({ zone: before, at }), 23);
    assert.equal(localHourIn({ zone: after, at }), 0);
  });
});
