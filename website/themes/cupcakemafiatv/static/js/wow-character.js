(() => {
 const card=document.querySelector('.wow-character-card');if(!card)return;
 let busy=false;
 async function refresh(){if(busy||document.hidden)return;busy=true;try{
 const response=await fetch('https://cupcakemafiatv-github-io.vercel.app/api/wow-character',{signal:AbortSignal.timeout(15000)});if(!response.ok)return;const data=await response.json();if(!data.available||!Number.isInteger(data.level)||data.level<1)return;
 card.querySelector('[data-wow-level]').textContent='Level '+data.level;
 const spec=card.querySelector('.wow-spec-text'),icon=card.querySelector('.wow-spec-link img');
 if(['Enhancement','Elemental','Restoration'].includes(data.specialization)){
  spec.textContent=data.specialization+' Shaman';spec.title='Specialization reported by Blizzard';
  icon.src=data.specialization==='Enhancement'?'/img/wow/enhancement.jpg':'/img/wow/shaman-class-icon.png';
 }else{
  spec.textContent='Enhancement Shaman';spec.title='Preferred build: Enhancement. Level and character artwork update automatically.';
  icon.src='/img/wow/enhancement.jpg';
 }
 if(data.artwork){const url=new URL(data.artwork);if(url.protocol==='https:'&&url.hostname==='render.worldofwarcraft.com'&&!url.username&&!url.password){const image=card.querySelector('.wow-character-model img');image.addEventListener('error',()=>{image.src='/img/wow/cupcake-mafia.png';},{once:true});if(image.src!==url.href)image.src=url.href;}}
 }catch{}finally{busy=false;}}
 refresh();setInterval(refresh,3600000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();
