(() => {
 const card=document.getElementById('solo-rank-card'); if(!card)return;
 const el=id=>document.getElementById('solo-rank-'+id);
 let busy=false, lastGood=null, matchLinks=[], ladder=null;
 const ladderKey='cmtv_na_ladder_v2';
 const validLadder=value=>value&&Number.isSafeInteger(value.rank)&&value.rank>0&&Number.isFinite(value.topPercent)&&value.topPercent>0&&value.topPercent<=100&&value.region==='NA'&&Number.isFinite(Date.parse(value.updatedAt))&&Date.now()-Date.parse(value.updatedAt)<259200000&&Date.parse(value.updatedAt)<=Date.now()+60000;
 function displayLadder(){
  const badge=document.getElementById('solo-ladder-badge');if(!badge)return;
  const valid=validLadder(ladder);
  badge.hidden=!valid;if(!valid)return;
  badge.textContent='Top '+new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(ladder.topPercent)+'% · NA';
  badge.title='OP.GG ladder rank '+new Intl.NumberFormat('en-US').format(ladder.rank)+' · last checked '+new Date(ladder.updatedAt).toLocaleString();
 }
 function recentMatches(data){
  const matches=data.recentMatches||[];
  // During the five-to-eight migration, only append OP.GG games when the
  // newest Riot games match its sequence by champion, result, and timestamp.
  if(matches.length>0&&matches.length<8&&matchLinks.length>=8&&matches.every((m,i)=>{const o=matchLinks[i];return o&&o.champion===m.champion&&o.result===m.result&&Math.abs(o.playedAt-m.playedAt)<=120000;}))return [...matches,...matchLinks.slice(matches.length,8)];
  return matches;
 }
 const safeMatchUrl=url=>typeof url==='string'&&/^https:\/\/op\.gg\/lol\/summoners\/na\/CupcakeMafia-NA1\/matches\/[A-Za-z0-9_%=-]+\/\d{13}$/.test(url);
 function exactMatchUrl(match){
  const candidates=matchLinks.filter(link=>link.champion===match.champion&&link.result===match.result&&Number.isFinite(link.playedAt)&&Number.isFinite(match.playedAt)&&Math.abs(link.playedAt-match.playedAt)<=120000&&safeMatchUrl(link.url));
  return candidates.length===1?candidates[0].url:null;
 }
 async function loadMatchLinks(url){
  try{const response=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!response.ok)return;const data=await response.json();if(Array.isArray(data.matches)&&data.matches.length)matchLinks=[...new Map([...matchLinks,...data.matches.map(m=>({...m,champion:m.champion==='Twisted Fate'?'TwistedFate':m.champion}))].filter(m=>safeMatchUrl(m.url)).map(m=>[m.url,m])).values()].sort((a,b)=>b.playedAt-a.playedAt).slice(0,20);const next={...data.ladder,updatedAt:data.ladder?.updatedAt||data.updatedAt};if(validLadder(next)&&(!ladder||Date.parse(next.updatedAt)>=Date.parse(ladder.updatedAt))){ladder=next;try{localStorage.setItem(ladderKey,JSON.stringify(ladder));}catch{}}displayLadder();if(lastGood)display(lastGood);}catch{}
 }
 const validRank=r=>r && typeof r.tier==='string' && typeof r.division==='string' && ['leaguePoints','wins','losses'].every(k=>Number.isInteger(r[k])&&r[k]>=0);
 function display(data) {
  if(!data || data.available!==true || !Number.isFinite(Date.parse(data.updatedAt)) || (data.rank!==null&&!validRank(data.rank))) throw new Error('Unavailable');
  const rank=data.rank;
  el('name').textContent=rank ? rank.tier.charAt(0)+rank.tier.slice(1).toLowerCase()+(['MASTER','GRANDMASTER','CHALLENGER'].includes(rank.tier)?'':' '+rank.division) : 'Unranked';
  el('lp').textContent=rank?rank.leaguePoints:'—';
  el('wins').textContent=rank?rank.wins:'—'; el('losses').textContent=rank?rank.losses:'—';
  el('wr').textContent=rank&&rank.wins+rank.losses>0?(100*rank.wins/(rank.wins+rank.losses)).toFixed(0)+'%':'—';
  const emblem=el('emblem');
  const tiers=['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER'];
  emblem.hidden=!(rank&&tiers.includes(rank.tier));
  if(!emblem.hidden){emblem.src='/img/ranks/'+rank.tier.toLowerCase()+'.png';emblem.alt=rank.tier.toLowerCase()+' rank emblem';}
  const recent=el('recent');recent.replaceChildren();
  if(Array.isArray(data.recentMatches)){
   if(!data.recentMatches.length)recent.textContent='No recent Solo/Duo games';
   for(const match of recentMatches(data).slice(0,8)){
    if(!['W','L','R'].includes(match.result))continue;
    const badge=document.createElement('span');badge.className='solo-result result-'+match.result;badge.textContent=match.result;
    badge.title=(match.result==='W'?'Win':match.result==='L'?'Loss':'Remake')+(match.champion?' · '+match.champion:'')+(data.recentMatchesStale?' · Last confirmed result':'');
    badge.setAttribute('aria-label',badge.title);
    const matchUrl=exactMatchUrl(match);
    const item=document.createElement(matchUrl?'a':'div');item.className='solo-match';
    if(matchUrl){item.href=matchUrl;item.target='_blank';item.rel='noopener noreferrer';item.title='View '+(match.champion||'champion')+' game on OP.GG';item.setAttribute('aria-label',badge.title+' — view game on OP.GG (opens in a new tab)');}
    const portrait=document.createElement('img');portrait.className='solo-champion';portrait.width=36;portrait.height=36;portrait.alt=match.champion||'Champion';portrait.loading='lazy';
    if(typeof match.champion==='string'&&/^[A-Za-z0-9]+$/.test(match.champion)){
      portrait.src='https://ddragon.leagueoflegends.com/cdn/16.22.1/img/champion/'+match.champion+'.png';
    }
    portrait.addEventListener('error',()=>{portrait.hidden=true;},{once:true});
    item.append(portrait,badge);recent.append(item);
   }
  }else recent.textContent='Match history pending';
  card.setAttribute('aria-busy','false');
  lastGood=data;
 }
 async function refresh(){
  if(busy||document.hidden)return;busy=true;
  try {
   const response=await fetch('https://cupcakemafiatv-github-io.vercel.app/api/league-rank',{signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error('Unavailable');display(await response.json());
  }catch{
   if(lastGood)display({...lastGood,stale:true});
   else{el('name').textContent='Rank temporarily unavailable';card.setAttribute('aria-busy','false');}
  }finally{busy=false;}
 }
 try{const cached=JSON.parse(localStorage.getItem(ladderKey));if(validLadder(cached))ladder=cached;}catch{}displayLadder();
 loadMatchLinks('/data/opgg-match-links.json').then(()=>loadMatchLinks('https://cupcakemafiatv-github-io.vercel.app/api/league-rank?view=match-links'));
 setInterval(()=>{if(!document.hidden)loadMatchLinks('https://cupcakemafiatv-github-io.vercel.app/api/league-rank?view=match-links');},900000);
 refresh();setInterval(refresh,300000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();
