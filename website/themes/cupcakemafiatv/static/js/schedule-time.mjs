export const STREAM_TIME_ZONE = 'America/Toronto';

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: STREAM_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function easternParts(date) {
  const fields = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return {
    year: Number(fields.year), month: Number(fields.month), day: Number(fields.day),
    hour: Number(fields.hour), minute: Number(fields.minute), second: Number(fields.second),
    weekday: weekdays.indexOf(fields.weekday)
  };
}

// Resolve each scheduled wall-clock time using the offset on that date, including DST.
function easternStart(year, month, day, hour, minute) {
  const wallTime = Date.UTC(year, month - 1, day, hour, minute);
  let timestamp = wallTime;
  for (let attempt = 0; attempt < 4; attempt++) {
    const actual = easternParts(new Date(timestamp));
    const correction = wallTime - Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    if (correction === 0) return new Date(timestamp);
    timestamp += correction;
  }
  return null;
}

export function getNextStream(schedule, now = new Date()) {
  const today = easternParts(now);
  const localDate = Date.UTC(today.year, today.month - 1, today.day);
  for (let offset = 0; offset <= 7; offset++) {
    const weekday = (today.weekday + offset) % 7;
    const entry = schedule.find(item => Number(item.day) === weekday);
    if (!entry?.time || !/^\d{2}:\d{2}$/.test(entry.time)) continue;
    const [hour, minute] = entry.time.split(':').map(Number);
    if (hour > 23 || minute > 59) continue;
    const date = new Date(localDate + offset * 86400000);
    const startsAt = easternStart(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hour, minute);
    if (startsAt && startsAt.getTime() > now.getTime()) return { ...entry, startsAt, dayOffset: offset };
  }
  return null;
}

export function formatCountdown(milliseconds) {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor(total % 86400 / 3600);
  const minutes = Math.floor(total % 3600 / 60);
  const seconds = total % 60;
  const clock = [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
  return days ? `${days}d ${clock}` : clock;
}
