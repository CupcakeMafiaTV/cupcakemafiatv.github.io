(() => {
 const card=document.querySelector('.wow-character-card');if(!card)return;
 const key='cmtv_wow_character_v1',maxAge=7*86400000;
 let busy=false,lastUpdated=Date.parse(card.getAttribute('data-wow-updated-at'))||0;
 function snapshot(value){
  if(value?.available!==true||!Number.isSafeInteger(value.level)||value.level<1||value.level>100)return null;
  const time=Date.parse(value.updatedAt);
  if(!Number.isFinite(time)||time>Date.now()+60000||Date.now()-time>maxAge)return null;
  let artwork=null;
  try{const url=new URL(value.artwork);if(url.protocol==='https:'&&url.hostname==='render.worldofwarcraft.com'&&!url.username&&!url.password)artwork=url.href;}catch{}
  return {available:true,level:value.level,specialization:['Enhancement','Elemental','Restoration'].includes(value.specialization)?value.specialization:null,artwork,updatedAt:value.updatedAt};
 }
 function display(value){
  const data=snapshot(value);if(!data||Date.parse(data.updatedAt)<lastUpdated)return;
  card.querySelector('[data-wow-level]').textContent='Level '+data.level;
  const spec=card.querySelector('.wow-spec-text'),icon=card.querySelector('.wow-spec-link img');
  spec.textContent=(data.specialization||'Enhancement')+' Shaman';
  spec.title=data.specialization?'Specialization reported by Blizzard':'Preferred build: Enhancement. Level and character artwork update automatically.';
  icon.src=!data.specialization||data.specialization==='Enhancement'?'/img/wow/enhancement.jpg':'/img/wow/shaman-class-icon.png';
  if(data.artwork){
   const image=card.querySelector('.wow-character-model img');
   if(image.src!==data.artwork){image.addEventListener('error',()=>{image.src='/img/wow/cupcake-mafia.png';},{once:true});image.src=data.artwork;}
  }
  lastUpdated=Date.parse(data.updatedAt);
  card.setAttribute('data-wow-updated-at',data.updatedAt);
  card.querySelector('[data-wow-level]').title='Last confirmed '+new Date(data.updatedAt).toLocaleString();
  try{localStorage.setItem(key,JSON.stringify(data));}catch{}
 }
 try{display(JSON.parse(localStorage.getItem(key)));}catch{}
 async function refresh(){
  if(busy||document.hidden)return;busy=true;
  try{
   const response=await fetch('https://cupcakemafiatv-github-io.vercel.app/api/wow-character',{signal:AbortSignal.timeout(15000)});
   if(response.ok)display(await response.json());
  }catch{}finally{busy=false;}
 }
 refresh();setInterval(refresh,3600000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();
