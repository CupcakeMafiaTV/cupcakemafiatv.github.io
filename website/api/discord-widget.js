export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');

  const INVITE_CODE = 'DPjsCV6RMj';

  try {
    const inviteRes = await fetch(`https://discord.com/api/v10/invites/${INVITE_CODE}?with_counts=true`);
    const inviteData = await inviteRes.json();

    if (!inviteRes.ok || !inviteData.guild) {
      return res.status(500).json({ error: 'Failed to resolve Discord invite', details: inviteData });
    }

    const iconUrl = inviteData.guild.icon
      ? `https://cdn.discordapp.com/icons/${inviteData.guild.id}/${inviteData.guild.icon}.png`
      : null;

    return res.status(200).json({
      memberCount: inviteData.approximate_member_count ?? null,
      onlineCount: inviteData.approximate_presence_count ?? null,
      guildName: inviteData.guild.name,
      iconUrl,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
