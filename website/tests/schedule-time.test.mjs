import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getNextStream, formatCountdown } from '../themes/cupcakemafiatv/static/js/schedule-time.mjs';

const schedule = JSON.parse(await readFile(new URL('../data/stream_schedule.json', import.meta.url), 'utf8'));

test('before a stream starts, the countdown targets today in Eastern time', () => {
  const next = getNextStream(schedule, new Date('2026-11-11T23:00:00Z'));
  assert.equal(next.day, 3);
  assert.equal(next.dayOffset, 0);
  assert.equal(next.startsAt.toISOString(), '2026-11-12T00:00:00.000Z');
});

test('at the start time, it advances past off days to the next scheduled stream', () => {
  const next = getNextStream(schedule, new Date('2026-11-12T00:00:00Z'));
  assert.equal(next.day, 5);
  assert.equal(next.startsAt.toISOString(), '2026-11-14T00:00:00.000Z');
});

test('daylight saving changes use the target date offset, not the current offset', () => {
  const spring = getNextStream([{ day: 0, name: 'Sunday', time: '19:00' }], new Date('2026-03-07T23:00:00Z'));
  assert.equal(spring.startsAt.toISOString(), '2026-03-08T23:00:00.000Z');
  const fall = getNextStream([{ day: 0, name: 'Sunday', time: '19:00' }], new Date('2026-10-31T22:00:00Z'));
  assert.equal(fall.startsAt.toISOString(), '2026-11-02T00:00:00.000Z');
});

test('the next occurrence can roll to the same day in the following week', () => {
  const next = getNextStream([{ day: 1, name: 'Monday', time: '19:00' }], new Date('2026-11-10T01:00:00Z'));
  assert.equal(next.dayOffset, 7);
  assert.equal(next.startsAt.toISOString(), '2026-11-17T00:00:00.000Z');
});

test('empty schedules and invalid entries have no upcoming stream', () => {
  assert.equal(getNextStream([], new Date('2026-11-11T23:00:00Z')), null);
  assert.equal(getNextStream([{ day: 3, time: '27:00' }], new Date('2026-11-11T23:00:00Z')), null);
});

test('countdown formatting supports days, seconds and a non-negative finish', () => {
  assert.equal(formatCountdown(90061000), '1d 01:01:01');
  assert.equal(formatCountdown(3599000), '00:59:59');
  assert.equal(formatCountdown(-1), '00:00:00');
});
