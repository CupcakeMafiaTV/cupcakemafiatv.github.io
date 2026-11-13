import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../themes/cupcakemafiatv/static/js/stream-media.js',import.meta.url),'utf8');
function setup({live=false,width=1080,hidden=false,observer=true,scrollContainer=null}={}){
 const listeners=new Set(),observers=[],resizers=[];
 function element(tag){let src;return{tag,dataset:{},children:[],writes:0,set src(value){src=value;this.writes++;},get src(){return src;},append(...children){this.children.push(...children);},addEventListener(){}};}
 const document={hidden,getElementById(){return null;},createElement:element,addEventListener(name,callback){if(name==='visibilitychange')listeners.add(callback);},removeEventListener(name,callback){listeners.delete(callback);}};
 class IntersectionObserver{constructor(callback,options){this.callback=callback;this.options=options;this.disconnected=false;observers.push(this);}observe(target){this.target=target;}disconnect(){this.disconnected=true;}near(){this.callback([{isIntersecting:true,intersectionRatio:0}]);}far(){this.callback([{isIntersecting:false,intersectionRatio:0}]);}}
 class ResizeObserver{constructor(callback){this.callback=callback;resizers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
 const context={document,window:observer?{IntersectionObserver}:{},IntersectionObserver,ResizeObserver,getComputedStyle:element=>({overflowY:element.overflowY||"visible"}),location:{hostname:'cupcakemafiatv.com'},URL};
 const mount=vm.runInNewContext(source.replace('export function mountStreamMedia','function mountStreamMedia')+';mountStreamMedia;',context);
 const container={parentElement:scrollContainer,clientWidth:width,children:[],classList:{toggle(){}},replaceChildren(...children){this.children=children;}};
 const controller=new AbortController();
 mount(container,{isLive:live,clip:live?null:{id:'SelectedClip',title:'Selected clip'}},controller.signal);
 return{container,document,controller,observers,resizers,listeners,reveal(){document.hidden=false;for(const callback of [...listeners])callback();}};
}
test('a far-away player stays unloaded and starts on first proximity without half visibility',()=>{
 const state=setup();const observer=state.observers[0],frame=state.container.children[0];
 assert.equal(frame.src,undefined);observer.far();assert.equal(frame.src,undefined);
 assert.equal(observer.options.rootMargin,'0px 0px 300px 0px');assert.equal(observer.options.threshold,0);
 observer.near();const url=new URL(frame.src);assert.equal(url.searchParams.get('autoplay'),'true');assert.equal(url.searchParams.get('muted'),'true');assert.equal(url.searchParams.get('clip'),'SelectedClip');assert.equal(url.searchParams.get('parent'),'cupcakemafiatv.com');assert.equal(observer.disconnected,true);
 observer.near();assert.equal(frame.writes,1);
});
test('live streams request muted autoplay when approached too',()=>{
 const state=setup({live:true});state.observers[0].near();const url=new URL(state.container.children[0].src);assert.equal(url.hostname,'player.twitch.tv');assert.equal(url.searchParams.get('channel'),'cupcakemafiatv');assert.equal(url.searchParams.get('autoplay'),'true');assert.equal(url.searchParams.get('muted'),'true');
});
test('hidden tabs defer loading until visible and aborted players never start',()=>{
 const hidden=setup({hidden:true});hidden.observers[0].near();assert.equal(hidden.container.children[0].src,undefined);hidden.reveal();assert(hidden.container.children[0].src);assert.equal(hidden.listeners.size,0);
 const cancelled=setup();cancelled.controller.abort();cancelled.observers[0].near();assert.equal(cancelled.container.children[0].src,undefined);assert.equal(cancelled.observers[0].disconnected,true);assert.equal(cancelled.resizers[0].disconnected,true);
});
test('narrow screens retain the Twitch link and resizing keeps the selected clip',()=>{
 const state=setup({width:335});assert.equal(state.container.children[0].tag,'a');assert.equal(state.container.children[0].href,'https://clips.twitch.tv/SelectedClip');assert.equal(state.observers.length,0);
 state.container.clientWidth=1080;state.resizers[0].callback();state.observers[0].near();const frame=state.container.children[0];assert.equal(new URL(frame.src).searchParams.get('clip'),'SelectedClip');
 state.container.clientWidth=900;state.resizers[0].callback();assert.equal(state.container.children[0],frame);assert.equal(frame.writes,1);
});
test('browsers without proximity observation retain manual playback, including hidden initial tabs',()=>{
 const state=setup({observer:false,hidden:true});assert.equal(state.container.children[0].src,undefined);state.reveal();assert.equal(new URL(state.container.children[0].src).searchParams.get('autoplay'),'false');
});

test('early-loading margin uses the actual scrolling ancestor instead of the clipped outer viewport',()=>{
 const scrollRoot={overflowY:'auto',scrollHeight:2600,clientHeight:720,parentElement:null};
 const wrapper={overflowY:'hidden',scrollHeight:605,clientHeight:605,parentElement:scrollRoot};
 const state=setup({scrollContainer:wrapper});assert.equal(state.observers[0].options.root,scrollRoot);state.observers[0].near();assert(state.container.children[0].src);
});
