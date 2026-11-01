import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { eligibleClips } from '../themes/cupcakemafiatv/static/js/clip-playlist.js';
const output = fileURLToPath(new URL('../static/data/twitch-clips.json', import.meta.url));
try {
  const response = await fetch('https://cupcakemafiatv-github-io.vercel.app/api/twitch-clips', {signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw Error('Clip feed returned ' + response.status);
  const data = await response.json();
  if (!Array.isArray(data.clips) || data.clips.some(c => !c.createdAt)) throw Error('Clip feed does not include clip dates yet');
  const clips = eligibleClips(data.clips);
  await fs.writeFile(output, JSON.stringify({generatedAt:new Date().toISOString(),clips},null,2)+'\n');
  console.log('Updated catalog: ' + clips.length + ' Twitch embeds. No videos downloaded.');
} catch(error) {
  const saved = JSON.parse(await fs.readFile(output,'utf8'));
  const clips = eligibleClips(saved.clips);
  await fs.writeFile(output, JSON.stringify({...saved,clips},null,2)+'\n');
  console.warn(error.message + '; retained ' + clips.length + ' age-checked catalog entries.');
}
