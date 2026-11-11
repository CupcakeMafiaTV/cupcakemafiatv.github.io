const PROFILE='https://op.gg/lol/summoners/na/CupcakeMafia-NA1';
export const MATCH_PAGE=PROFILE+'?queue_type=SOLORANKED';
export function parseMatchLinks(html){
 const matches=[];
 for(const script of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  let data;try{data=JSON.parse(script[1]);}catch{continue;}
  for(const list of data['@graph']||[]){
   if(list['@id']!==PROFILE+'#recent-games'||!Array.isArray(list.itemListElement))continue;
   for(const entry of list.itemListElement.slice(0,20)){
    const game=entry.item;if(!game||!Array.isArray(game.additionalProperty))continue;
    const props=Object.fromEntries(game.additionalProperty.map(p=>[p.name,p.value]));
    const champion=props.champion==='Twisted Fate'?'TwistedFate':props.champion;
    const playedAt=Date.parse(game.startTime),result={WIN:'W',LOSE:'L',REMAKE:'R'}[props.result];
    if(props.queueType!=='SOLORANKED'||!result||!Number.isFinite(playedAt)||typeof champion!=='string'||!(/^[A-Za-z0-9]+$/).test(champion)||typeof props.matchId!=='string'||!(/^[A-Za-z0-9_-]{32,96}={0,2}$/).test(props.matchId))continue;
    matches.push({champion,result,playedAt,url:PROFILE+'/matches/'+encodeURIComponent(props.matchId)+'/'+playedAt});
   }
  }
 }
 return matches;
}

export function parseLadderRank(html){
 // Read the visible ladder link, not translated template strings or guessed totals.
 const link=html.match(/<a\b[^>]*href=["'][^"']*\/lol\/leaderboards\/tier[^"']*region=na[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
 if(!link)return null;
 const text=link[1].replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ');
 const value=text.match(/Ladder Rank\s+([\d,]+)\s*\(\s*(\d+(?:\.\d+)?)% of top\s*\)/i);
 if(!value)return null;
 const rank=Number(value[1].replaceAll(',','')),topPercent=Number(value[2]);
 return Number.isSafeInteger(rank)&&rank>0&&topPercent>0&&topPercent<=100?{rank,topPercent,region:'NA'}:null;
}
