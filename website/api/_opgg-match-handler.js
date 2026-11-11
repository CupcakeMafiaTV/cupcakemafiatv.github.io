import {setCors} from './_cors.js';
import {MATCH_PAGE,parseMatchLinks,parseLadderRank} from './_opgg-match-links.js';
const KEY='cmtv:opgg:solo:snapshot:v2',FRESH_MS=900000;
let saved=null,nextCheck=0,pending=null;
async function redis(command){
 if(!process.env.KV_REST_API_URL||!process.env.KV_REST_API_TOKEN)return null;
 const response=await fetch(process.env.KV_REST_API_URL,{method:'POST',headers:{Authorization:'Bearer '+process.env.KV_REST_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(1500)});
 if(!response.ok)throw new Error('Cache unavailable');return (await response.json()).result;
}
async function refresh(){
 if(!saved){try{const cached=JSON.parse(await redis(['GET',KEY]));if(cached&&Array.isArray(cached.matches)&&Number.isFinite(Date.parse(cached.updatedAt)))saved=cached;}catch{}}
 if(saved&&Date.now()-Date.parse(saved.updatedAt)<FRESH_MS){nextCheck=Date.parse(saved.updatedAt)+FRESH_MS;return;}
 nextCheck=Date.now()+120000;
 try{
  const response=await fetch(MATCH_PAGE,{signal:AbortSignal.timeout(6000)});
  if(!response.ok)throw new Error('Unavailable');
  const html=await response.text();if(html.length>3000000)throw new Error('Oversized page');
  const matches=parseMatchLinks(html),ladder=parseLadderRank(html);
  // Percentile and match links are independent: either can refresh on its own.
  if(!matches.length&&!ladder)throw new Error('No verified data');
  const updatedAt=new Date().toISOString();
  saved={matches:matches.length?matches:(saved?.matches||[]),ladder:ladder?{...ladder,updatedAt}:(saved?.ladder||null),updatedAt};
  nextCheck=Date.now()+FRESH_MS;
  try{await redis(['SET',KEY,JSON.stringify(saved),'EX',259200]);}catch{}
 }catch{}
}
export default async function handler(req,res){
 setCors(req,res,'GET');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
 if(Date.now()>=nextCheck){if(!pending)pending=refresh().finally(()=>{pending=null;});}
 if(pending)await pending;
 const stale=!saved||Date.now()-Date.parse(saved.updatedAt)>=FRESH_MS;
 res.setHeader('Cache-Control',stale?'s-maxage=60, stale-while-revalidate=300':'s-maxage=900, stale-while-revalidate=3600');
 return res.status(200).json(saved?{...saved,stale}:{matches:[],ladder:null,updatedAt:null,stale:true});
}
