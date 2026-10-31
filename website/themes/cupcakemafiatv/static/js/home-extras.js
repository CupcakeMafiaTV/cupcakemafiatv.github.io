// Highlight the current day in the stream's timezone; times stay in Eastern Time.
function highlightToday() {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', weekday: 'short' }).format(new Date());
  const today = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  document.querySelectorAll('.schedule-day').forEach(card => card.classList.toggle('schedule-day-today', Number(card.dataset.day) === today));
}
highlightToday();
setInterval(highlightToday, 60000);
