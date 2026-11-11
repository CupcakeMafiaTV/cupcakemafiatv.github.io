(() => {
 const league=document.getElementById('solo-rank-card'),wow=document.querySelector('.wow-character-card');
 if(!league||!wow)return;
 const rankSection=league.closest('.ranked-spotlight'),wowSection=wow.closest('.wow-character-section');
 const tablet=matchMedia('(min-width:900px) and (max-width:1199px)');
 let pending=false;
 const set=(el,name,value)=>{if(el.style.getPropertyValue(name)!==value)el.style.setProperty(name,value);};
 const sync=()=>{
  pending=false;
  const bounds=rankSection.getBoundingClientRect();
  let rankTop=0;for(let node=rankSection;node;node=node.offsetParent)rankTop+=node.offsetTop;
  set(rankSection,'--rank-section-top',Math.max(0,rankTop)+'px');
  set(wowSection,'--league-section-height',Math.ceil(bounds.height)+'px');
  if(tablet.matches)set(wow,'--league-card-height',Math.ceil(league.getBoundingClientRect().height)+'px');
  else wow.style.removeProperty('--league-card-height');
 };
 const schedule=()=>{if(!pending){pending=true;requestAnimationFrame(sync);}};
 const observer=new ResizeObserver(schedule);
 for(const element of [league,rankSection,...document.querySelectorAll('.hero-wrap,.audience-band')])observer.observe(element);
 window.addEventListener('resize',schedule,{passive:true});
 document.fonts.ready.then(schedule);schedule();
})();
