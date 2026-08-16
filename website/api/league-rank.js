export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const API_KEY = process.env.RIOT_API_KEY;
  const GAME_NAME = 'CupcakeMafia';
  const TAG_LINE = 'NA1';

  if (!API_KEY) {
    return res.status(500).json({ error: 'Missing RIOT_API_KEY environment variable in Vercel' });
  }

  try {
    // 1. Resolve Riot ID (GameName#TagLine) to a PUUID via regional routing.
    const accountRes = await fetch(
      `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(GAME_NAME)}/${encodeURIComponent(TAG_LINE)}`,
      { headers: { 'X-Riot-Token': API_KEY } }
    );
    const accountData = await accountRes.json();

    if (!accountRes.ok || !accountData.puuid) {
      return res.status(500).json({ error: 'Failed to resolve Riot ID', details: accountData });
    }

    const puuid = accountData.puuid;

    // 2. Ranked Solo Queue stats via platform routing (NA1).
    const leagueRes = await fetch(
      `https://na1.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`,
      { headers: { 'X-Riot-Token': API_KEY } }
    );
    const leagueData = await leagueRes.json();
    const soloQueue = Array.isArray(leagueData)
      ? leagueData.find((entry) => entry.queueType === 'RANKED_SOLO_5x5')
      : null;

    // 3. Check if currently in a live ranked game.
    const spectatorRes = await fetch(
      `https://na1.api.riotgames.com/lol/spectator/v5/active-games/by-puuid/${puuid}`,
      { headers: { 'X-Riot-Token': API_KEY } }
    );
    const inGame = spectatorRes.status === 200;
    let liveGame = null;
    if (inGame) {
      const spectatorData = await spectatorRes.json();
      liveGame = {
        gameMode: spectatorData.gameMode,
        gameLengthSeconds: spectatorData.gameLength,
      };
    }

    return res.status(200).json({
      rank: soloQueue
        ? {
            tier: soloQueue.tier,
            division: soloQueue.rank,
            leaguePoints: soloQueue.leaguePoints,
            wins: soloQueue.wins,
            losses: soloQueue.losses,
          }
        : null,
      inGame,
      liveGame,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
