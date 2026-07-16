const assert = require('node:assert/strict');
const test = require('node:test');
const { getDateKey, isDateKey } = require('../src/main/date-utils');

test('getDateKey uses the configured local timezone', () => {
  const eveningInChicago = new Date('2026-07-17T01:30:00.000Z');
  assert.equal(getDateKey(eveningInChicago, 'America/Chicago'), '2026-07-16');
  assert.equal(getDateKey(eveningInChicago, 'UTC'), '2026-07-17');
});

test('isDateKey accepts archive directory names only', () => {
  assert.equal(isDateKey('2026-07-16'), true);
  assert.equal(isDateKey('.2026-07-16-partial'), false);
  assert.equal(isDateKey('../2026-07-16'), false);
});
