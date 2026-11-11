import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { easternParts, getNextStream, formatCountdown, STREAM_TIME_ZONE } from '../themes/cupcakemafiatv/static/js/schedule-time.mjs';

const source = (await readFile(new URL('../themes/cupcakemafiatv/static/js/home-extras.js', import.meta.url), 'utf8')).replace(/^import .*\n/, '');
const schedule = JSON.parse(await readFile(new URL('../data/stream_schedule.json', import.meta.url), 'utf8'));

function mount(live = false) {
  const listeners = new Map();
  const element = () => ({ hidden: false, textContent: '', classList: { values: new Set(), toggle(name, value) { value ? this.values.add(name) : this.values.delete(name); } } });
  const banner = element();
  const clock = element();
  const label = element();
  const liveLink = element();
  const cards = schedule.map(entry => ({ ...element(), dataset: { day: String(entry.day) }, closest: () => true, append(child) { child.parentElement = this; } }));
  const nodes = new Map([
    ['stream-schedule-data', { textContent: JSON.stringify(schedule) }],
    ['next-stream-banner', banner], ['next-stream-countdown', clock],
    ['next-stream-label', label], ['next-stream-live-link', liveLink]
  ]);
  const document = { hidden: false, querySelectorAll: () => cards, getElementById: id => nodes.get(id) || null, addEventListener: (name, callback) => listeners.set(name, callback) };
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-11-11T23:00:00Z'])); } }
  let requests = 0;
  vm.runInNewContext(source, { document, window: { cmtvTwitchIsLive: live }, Intl, Date: FixedDate, setInterval() {}, easternParts, getNextStream, formatCountdown, STREAM_TIME_ZONE, fetch() { requests++; throw Error('Countdown must not make API calls'); } });
  return { banner, clock, label, liveLink, listeners, requests: () => requests };
}

test('confirmed live status replaces the countdown and offline restores it without requests', () => {
  const widget = mount();
  assert.equal(widget.label.textContent, 'Next stream');
  assert.equal(widget.clock.hidden, false);
  assert.equal(widget.clock.textContent, '01:00:00');
  widget.listeners.get('cmtv:twitchstatus')({ detail: { isLive: true } });
  assert.equal(widget.label.textContent, 'Live now');
  assert.equal(widget.clock.hidden, true);
  assert.equal(widget.liveLink.hidden, false);
  assert.equal(widget.banner.parentElement.dataset.day, '3');
  widget.listeners.get('cmtv:twitchstatus')({ detail: { isLive: false } });
  assert.equal(widget.label.textContent, 'Next stream');
  assert.equal(widget.clock.hidden, false);
  assert.equal(widget.liveLink.hidden, true);
  assert.equal(widget.requests(), 0);
});

test('live status already available at module startup is honored, and unknown status does not erase it', () => {
  const widget = mount(true);
  assert.equal(widget.label.textContent, 'Live now');
  widget.listeners.get('cmtv:twitchstatus')({ detail: { isLive: null } });
  assert.equal(widget.label.textContent, 'Live now');
  assert.equal(widget.requests(), 0);
});
