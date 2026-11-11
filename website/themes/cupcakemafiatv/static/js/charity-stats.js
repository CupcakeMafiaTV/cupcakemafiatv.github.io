(() => {
  'use strict';

  const stats = document.getElementById('charity-stats');
  if (!stats) return;

  const participantId = Number(stats.dataset.participantId);
  const historicalCents = Number(stats.dataset.historicalCents);
  const historicalDonations = Number(stats.dataset.historicalDonations);
  const raised = document.getElementById('charity-raised');
  const donations = document.getElementById('charity-donations');
  const status = document.getElementById('charity-stats-status');
  const interval = 60_000;
  const cacheKey = `cmtv-charity-${participantId}-v1`;
  let busy = false;
  let lastAttempt = 0;
  let lastGood = null;

  if (!Number.isSafeInteger(participantId) || participantId <= 0 ||
      !Number.isSafeInteger(historicalCents) || historicalCents < 0 ||
      !Number.isSafeInteger(historicalDonations) || historicalDonations < 0 ||
      !raised || !donations || !status) return;

  function valid(data) {
    return data && data.participantID === participantId &&
      typeof data.sumDonations === 'number' && Number.isFinite(data.sumDonations) &&
      data.sumDonations >= 0 && Number.isSafeInteger(data.numDonations) &&
      data.numDonations >= 0 &&
      Number.isSafeInteger(historicalCents + Math.round(data.sumDonations * 100)) &&
      Number.isSafeInteger(historicalDonations + data.numDonations);
  }

  function render(data) {
    // Add this campaign to the fixed pre-campaign totals, never to the DOM's
    // previous value: repeated refreshes must not count donations twice.
    raised.textContent = ((historicalCents + Math.round(data.sumDonations * 100)) / 100)
      .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    donations.textContent = (historicalDonations + data.numDonations).toLocaleString('en-US');
    lastGood = data;
  }

  try {
    const saved = JSON.parse(localStorage.getItem(cacheKey));
    if (valid(saved)) render(saved);
  } catch { /* Storage can be disabled; live stats still work. */ }

  async function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    lastAttempt = Date.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`https://dd.extra-life.org/api/participants/${participantId}`, {
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal
      });
      if (!response.ok) throw new Error('Extra Life is unavailable');
      const data = await response.json();
      if (!valid(data)) throw new Error('Invalid Extra Life totals');
      render(data);
      stats.dataset.syncState = 'live';
      status.textContent = '';
      status.hidden = true;
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          participantID: participantId,
          sumDonations: data.sumDonations,
          numDonations: data.numDonations
        }));
      } catch { /* A storage failure must not hide a successful live update. */ }
    } catch {
      stats.dataset.syncState = 'unavailable';
      status.hidden = false;
      status.textContent = lastGood
        ? 'Showing the last available totals. Extra Life is temporarily unavailable; updates will retry automatically.'
        : 'Showing previously recorded totals. Extra Life is temporarily unavailable; updates will retry automatically.';
    } finally {
      window.clearTimeout(timeout);
      busy = false;
    }
  }

  void refresh();
  window.setInterval(refresh, interval);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastAttempt >= interval) void refresh();
  });
})();
