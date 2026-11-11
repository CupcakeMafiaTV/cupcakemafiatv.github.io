import {setCors} from './_cors.js';
let token=null, tokenUntil=0, snapshot=null, pending=null, retryAt=0;
const SNAPSHOT_KEY='cmtv:wow:forever:cupcake-mafia:v2';
async function redis(command){if(!process.env.KV_REST_API_URL||!process.env.KV_REST_API_TOKEN)return null;const r=await fetch(process.env.KV_REST_API_URL,{method:'POST',headers:{Authorization:'Bearer '+process.env.KV_REST_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(1500)});if(!r.ok)return null;return (await r.json()).result;}
function mediaUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='render.worldofwarcraft.com'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
async function refresh(){
 const id=process.env.BLIZZARD_CLIENT_ID,secret=process.env.BLIZZARD_CLIENT_SECRET;
 if(!id||!secret)throw new Error('Not configured');
 if(!token||Date.now()>tokenUntil){const r=await fetch('https://oauth.battle.net/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(id+':'+secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error('Authentication unavailable');const data=await r.json();if(typeof data.access_token!=='string')throw new Error('Invalid token');token=data.access_token;tokenUntil=Date.now()+Math.max(0,(Number(data.expires_in)||0)-60)*1000;}
 const get=async suffix=>{const r=await fetch('https://us.api.blizzard.com/profile/wow/character/cupcake-mafia'+suffix+'?namespace=profile-forever-us&locale=en_US',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000)});if(!r.ok){if(r.status===401){token=null;}if(r.status===429){const seconds=Number(r.headers.get('Retry-After'));retryAt=Date.now()+Math.max(60,Number.isFinite(seconds)?seconds:120)*1000;}throw new Error('Character unavailable');}return r.json();};
 const profile=await get('');if(!Number.isInteger(profile.level)||profile.level<1||profile.name!=='Cupcake'||profile.surname!=='Mafia')throw new Error('Invalid profile');
 let artwork=snapshot?.artwork||null;
 try{const media=await get('/character-media');artwork=mediaUrl(media.assets?.find(a=>a.key==='main-raw')?.value)||artwork;}catch{}
 const result={available:true,name:profile.name+' '+profile.surname,level:profile.level,race:profile.playable_race?.name||null,characterClass:profile.character_class?.name||null,faction:profile.faction?.name||null,ruleset:profile.ruleset?.name||null,region:'US',specialization:typeof profile.active_spec?.name==='string'?profile.active_spec.name:null,artwork,updatedAt:new Date().toISOString()};
 snapshot=result;try{await redis(['SET',SNAPSHOT_KEY,JSON.stringify(result)]);}catch{}return result;
}
export default async function handler(req,res){
 setCors(req,res,'GET,OPTIONS');res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');
 if(req.method==='OPTIONS')return res.status(204).end();if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
 if(!snapshot){try{const saved=JSON.parse(await redis(['GET',SNAPSHOT_KEY]));if(saved?.available&&Number.isInteger(saved.level)&&Number.isFinite(Date.parse(saved.updatedAt)))snapshot=saved;}catch{}}
 if(snapshot&&Date.now()-Date.parse(snapshot.updatedAt)<3600000)return res.status(200).json({...snapshot,stale:false});
 try{if(Date.now()<retryAt)throw new Error('Retry later');if(!pending)pending=refresh().finally(()=>{pending=null;});return res.status(200).json({...await pending,stale:false});}catch{res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=300');return res.status(200).json(snapshot?{...snapshot,stale:true}:{available:false,stale:true});}
}
