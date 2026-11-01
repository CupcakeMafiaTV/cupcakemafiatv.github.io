// Keep the calendar and next scheduled start in the stream's timezone.
function highlightToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/Toronto', weekday:'short', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).formatToParts(now);
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today = weekdays.indexOf(fields.weekday);
  const minutes = Number(fields.hour) * 60 + Number(fields.minute);
  const cards = [...document.querySelectorAll('.schedule-day, .watch-schedule-day')];
  const scheduleData = document.getElementById('stream-schedule-data');
  const schedule = scheduleData ? JSON.parse(scheduleData.textContent) : [];
  cards.forEach(card => card.classList.toggle('schedule-day-today', Number(card.dataset.day) === today));
  const upcoming = document.getElementById('next-stream-time');
  if (!upcoming) return;
  for (let offset = 0; offset < 8; offset++) {
    const day = (today + offset) % 7;
    const entry = schedule.find(entry => entry.day === day);
    if (!entry?.time) continue;
    const [hour, minute] = entry.time.split(':').map(Number);
    if (offset === 0 && minutes >= hour * 60 + minute) continue;
    const label = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : entry.name;
    const clock = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, hour, minute))).replace(':00', '');
    upcoming.textContent = label + ' \u00b7 ' + clock + ' ET';
    break;
  }
}
highlightToday();
setInterval(highlightToday, 60000);
