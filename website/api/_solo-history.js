const memory = new Map();
let cooldownUntil=0;
export async function soloHistory(puuid, riot, redis, now=Date.now()) {
 const key='cmtv:league:solo:recent:v2';
 let saved=memory.get(key);
 if(!saved){try{saved=JSON.parse(await redis(['GET',key]));}catch{}}
 if(saved&&now-saved.checkedAt<900000)return {matches:saved.matches,stale:false};
 if(now<cooldownUntil)return {matches:saved?.matches||null,stale:true};
 async function request(url){const response=await riot(url,4000);if(response.status===429){const seconds=Number(response.headers.get('Retry-After'));cooldownUntil=now+(Number.isFinite(seconds)&&seconds>0?seconds:120)*1000;}if(!response.ok)throw new Error('Match history unavailable');return response.json();}
 try{
 const ids=await request('https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/'+encodeURIComponent(puuid)+'/ids?queue=420&start=0&count=8');
 if(!Array.isArray(ids)||ids.length>8)throw new Error('Invalid history');
 const matches=[];
 for(const id of ids){
  if(typeof id!=='string'||!/^NA1_\d+$/.test(id))throw new Error('Invalid match id');
  let item=saved?.matches?.find(m=>m.id===id);
  if(!item){
   const data=await request('https://americas.api.riotgames.com/lol/match/v5/matches/'+id);
   const player=data.info?.participants?.find(p=>p.puuid===puuid);
   if(data.info?.queueId!==420||!player||typeof player.win!=='boolean')throw new Error('Invalid Solo/Duo match');
   item={id,result:player.gameEndedInEarlySurrender?'R':player.win?'W':'L',champion:player.championName||'',playedAt:data.info.gameEndTimestamp||null};
  }
  matches.push(item);
 }
 const snapshot={checkedAt:now,matches};memory.set(key,snapshot);
 try{await redis(['SET',key,JSON.stringify(snapshot)]);}catch{}
 return {matches,stale:false};
 }catch{return {matches:saved?.matches||null,stale:true};}
}
