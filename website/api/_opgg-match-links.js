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
    const playedAt=Date.parse(game.startTime),result={WIN:'W',LOSE:'L',REMAKE:'R'}[props.result];
    if(props.queueType!=='SOLORANKED'||!result||!Number.isFinite(playedAt)||typeof props.champion!=='string'||!(/^[A-Za-z0-9]+$/).test(props.champion)||typeof props.matchId!=='string'||!(/^[A-Za-z0-9_-]{32,96}={0,2}$/).test(props.matchId))continue;
    matches.push({champion:props.champion,result,playedAt,url:PROFILE+'/matches/'+encodeURIComponent(props.matchId)+'/'+playedAt});
   }
  }
 }
 return matches;
}
