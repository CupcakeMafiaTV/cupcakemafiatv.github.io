// Eastern wall-clock times are converted per date so DST changes stay correct.
export const STREAM_DAYS = [1, 3, 5, 6, 0];
export function easternParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
export function easternEvening(year, month, day) {
  const target = Date.UTC(year, month - 1, day, 19);
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const p = easternParts(new Date(instant));
    instant += target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  }
  return new Date(instant);
}
export function nextStreams(now = new Date()) {
  const p = easternParts(now), today = new Date(Date.UTC(p.year, p.month - 1, p.day));
  return STREAM_DAYS.map(day => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + (day - date.getUTCDay() + 7) % 7);
    let start = easternEvening(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    if (start <= now) {
      date.setUTCDate(date.getUTCDate() + 7);
      start = easternEvening(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
    return { day, start, title: day === 0 || day === 6 ? 'Community Night' : 'Solo Queue' };
  }).sort((a, b) => a.start - b.start);
}
const stamp = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
export function calendarEvent(stream, now = new Date()) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CupcakeMafiaTV//Stream Schedule//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:stream-${stamp(stream.start)}@cupcakemafiatv.com`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(stream.start)}`, `SUMMARY:CupcakeMafiaTV - ${stream.title}`, 'DESCRIPTION:Join the stream! Times may change. Check the website for updates.', 'URL:https://cupcakemafiatv.com/', 'LOCATION:https://www.twitch.tv/cupcakemafiatv', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
}
