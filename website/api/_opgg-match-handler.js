import {setCors} from './_cors.js';
import {MATCH_PAGE,parseMatchLinks} from './_opgg-match-links.js';
let saved=null,nextCheck=0;
export default async function handler(req,res){
 setCors(req,res,'GET');
 res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=3600');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
 if(Date.now()>=nextCheck){
  nextCheck=Date.now()+120000;
  try{
   const response=await fetch(MATCH_PAGE,{signal:AbortSignal.timeout(6000)});
   if(!response.ok)throw new Error('Unavailable');
   const html=await response.text();if(html.length>3000000)throw new Error('Oversized page');
   const matches=parseMatchLinks(html);if(!matches.length)throw new Error('No verified links');
   saved={matches,updatedAt:new Date().toISOString()};nextCheck=Date.now()+900000;
  }catch{}
 }
 return res.status(200).json(saved||{matches:[],updatedAt:null});
}
