'use strict';
const NAMES=['Solace','Vega','Arcturus','Nadir','Haven','Kestrel','Eos','Orion','Drift','Cygnus','Pavo','Altair','Lyra','Helix','Aquila','Kepler','Sirius','Astra','Rift','Umbra'];
const POINTS=[[112,260],[240,105],[350,255],[485,105],[640,245],[760,100],[850,275],[710,455],[550,395],[385,515],[210,460],[70,475],[165,360],[350,365],[520,225],[665,335],[820,555],[910,95],[960,420],[930,310]];
const EDGES=[[0,1],[0,11],[0,12],[1,2],[1,3],[2,3],[2,13],[2,14],[3,4],[3,17],[4,5],[4,14],[4,15],[5,6],[5,17],[6,7],[6,19],[7,8],[7,16],[8,9],[8,15],[9,10],[9,13],[10,11],[10,12],[11,12],[12,13],[13,14],[14,15],[15,18],[16,18],[18,19],[6,18]];
const HOMES=[0,5,10,15];
const DEPOSITS=['crystals','titanium','gas','minerals','titanium','gas','crystals','titanium','gas','crystals','minerals','gas','crystals','titanium','gas','minerals','crystals','titanium','gas','titanium'];
const RESOURCE_KEYS=['credits','minerals','alloys','energy','food','titanium','crystals','gas'];
const START_RESOURCES={credits:220,minerals:160,alloys:110,energy:100,food:100,titanium:20,crystals:20,gas:12};
const COSTS={
 mine:{credits:30,minerals:25},reactor:{credits:30,minerals:25},farm:{credits:25,minerals:20},
 shipyard:{credits:75,minerals:55,alloys:25},extractor:{credits:45,minerals:30,alloys:10},
 frigate:{credits:50,alloys:35,titanium:3},cruiser:{credits:95,alloys:80,titanium:12,gas:5},
 colony:{credits:65,alloys:30},upgrade:{credits:80,minerals:60,alloys:25}
};
const BUILD_TIMES={mine:12,reactor:12,farm:10,shipyard:24,extractor:15,frigate:14,cruiser:25,upgrade:28};
const RESEARCH={
 industry:{name:'Industrial Automation',science:65,crystals:4,description:'+50% mineral production'},
 engines:{name:'Hyperlane Drives',science:80,crystals:6,description:'Fleets travel 25% faster'},
 weapons:{name:'Plasma Weapons',science:90,crystals:7,description:'+35% fleet attack strength'},
 shields:{name:'Orbital Shields',science:75,crystals:5,description:'+4 colony defense'},
 logistics:{name:'Trade Logistics',science:70,crystals:5,description:'+30% credit production'}
};
const adjacent=i=>EDGES.flatMap(([a,b])=>a===i?[b]:b===i?[a]:[]);
function newGalaxy(){return {schema:1,time:0,version:1,nextId:1,aiClock:0,aiOrderClock:0,systems:NAMES.map((name,id)=>({id,name,x:POINTS[id][0],y:POINTS[id][1],owner:id===19?'pirates':null,deposit:DEPOSITS[id],level:1,ships:id===19?7:0,buildings:{mine:0,reactor:0,farm:0,shipyard:0,extractor:0}})),empires:{},fleets:[],jobs:[],treaties:[],offers:[],events:[]};}
function log(s,message,audience=null){s.events.unshift({time:Math.floor(s.time),message,audience});s.events=s.events.slice(0,70);}
function fail(message){throw Object.assign(new Error(message),{status:400});}
function who(s,id){const e=s.empires[id];if(!e)fail('Empire not found');return e;}
function system(s,id){if(!Number.isInteger(id)||!s.systems[id])fail('Unknown star system');return s.systems[id];}
function owns(s,id,sysId){const sys=system(s,sysId);if(sys.owner!==id)fail('You do not control that system');return sys;}
function has(e,cost){return Object.entries(cost).every(([k,v])=>Number.isFinite(e.resources[k])&&e.resources[k]>=v);}
function spend(e,cost){if(!has(e,cost))fail('Not enough resources');for(const [k,v] of Object.entries(cost))e.resources[k]-=v;}
function addEmpire(s,id,name){if(!/^[a-f0-9]{16}$/.test(id))fail('Invalid identity');if(s.empires[id])fail('Already joined');const count=Object.keys(s.empires).length;if(count>=HOMES.length)fail('The four-player playtest galaxy is full');const home=HOMES[count],sys=s.systems[home];if(sys.owner!==null)fail('Starting territory unavailable');const empire={id,name:String(name||'Commander').trim().slice(0,24)||'Commander',color:['#62deff','#78ecaf','#ffc078','#c995ff'][count],resources:{...START_RESOURCES},science:0,techs:[],reputation:0,recoveryReadyAt:0,createdAt:s.time};s.empires[id]=empire;sys.owner=id;sys.ships=5;sys.buildings={mine:1,reactor:1,farm:1,shipyard:1,extractor:0};log(s,empire.name+' established a colony on '+sys.name);s.version++;return empire;}
function path(s,owner,from,to){const q=[[from]],seen=new Set([from]);while(q.length){const p=q.shift(),v=p[p.length-1];if(v===to)return p;for(const n of adjacent(v)){if(!seen.has(n)&&(n===to||s.systems[n].owner===owner)){seen.add(n);q.push([...p,n]);}}}return null;}
function pact(s,a,b){return s.treaties.find(t=>t.active&&t.until>s.time&&((t.a===a&&t.b===b)||(t.a===b&&t.b===a)));}
function order(s,id,cmd){const e=who(s,id);if(!cmd||typeof cmd!=='object'||typeof cmd.type!=='string')fail('Invalid command');let result={ok:true};
 if(cmd.type==='colonize'){
  const x=system(s,cmd.system);if(x.owner!==null)fail('System is not unclaimed');
  if(!adjacent(x.id).some(n=>s.systems[n].owner===id))fail('Colony requires an adjacent friendly system');
  spend(e,COSTS.colony);x.owner=id;x.ships=1;x.level=1;log(s,e.name+' colonized '+x.name);
 }else if(cmd.type==='build'){
  const x=owns(s,id,cmd.system),type=cmd.building;if(!Object.prototype.hasOwnProperty.call(BUILD_TIMES,type))fail('Unknown construction');
  if(s.jobs.filter(j=>j.system===x.id).length>=4)fail('Construction queue is full');
  if((type==='frigate'||type==='cruiser')&&!x.buildings.shipyard)fail('A shipyard is required');
  if(type==='upgrade'&&x.level>=4)fail('Maximum colony level reached');
  if(type==='upgrade'&&s.jobs.some(j=>j.system===x.id&&j.type==='upgrade'))fail('Colony upgrade already queued');
  const cost=type==='upgrade'?Object.fromEntries(Object.entries(COSTS.upgrade).map(([k,v])=>[k,v*x.level])):COSTS[type];
  spend(e,cost);const job={id:s.nextId++,system:x.id,owner:id,type,remaining:BUILD_TIMES[type]};s.jobs.push(job);
  log(s,type+' construction queued at '+x.name,id);result.job=job.id;
 }else if(cmd.type==='fleet'){
  const x=owns(s,id,cmd.from),target=system(s,cmd.to),count=cmd.ships;
  if(!Number.isInteger(count)||count<=0||count>x.ships)fail('Invalid fleet strength');
  if(x.id===target.id)fail('Choose a different destination');
  if(target.owner&&target.owner!==id&&pact(s,id,target.owner))fail('Non-aggression pact prevents attacks');
  const route=path(s,id,x.id,target.id);if(!route||route.length<2)fail('No valid friendly hyperlane route');
  if(route.length>2&&!e.techs.includes('engines'))fail('Research Hyperlane Drives to command multi-hop fleets');
  x.ships-=count;const fleet={id:s.nextId++,owner:id,ships:count,path:route,hop:0,remaining:hopDuration(e),hopTotal:hopDuration(e)};
  s.fleets.push(fleet);log(s,e.name+' dispatched '+count+' ships from '+x.name+' toward '+target.name);result.fleet=fleet.id;
 }else if(cmd.type==='research'){
  const key=cmd.tech,tech=RESEARCH[key];if(!tech)fail('Unknown technology');
  if(e.techs.includes(key))fail('Already researched');if(e.science<tech.science)fail('Not enough science');
  spend(e,{crystals:tech.crystals});e.science-=tech.science;e.techs.push(key);log(s,e.name+' researched '+tech.name);
 }else if(cmd.type==='offerPact'){
  const other=who(s,cmd.target);if(other.id===id)fail('Choose another empire');
  if(pact(s,id,other.id))fail('Pact is already active');
  if(s.offers.some(o=>o.kind==='pact'&&o.from===id&&o.to===other.id&&o.until>s.time))fail('Pact already offered');
  const offer={id:s.nextId++,kind:'pact',from:id,to:other.id,until:s.time+180};s.offers.push(offer);
  log(s,e.name+' proposed a non-aggression pact to '+other.name);result.offer=offer.id;
 }else if(cmd.type==='offerTrade'){
  const other=who(s,cmd.target),resource=cmd.resource,give=cmd.give,receive=cmd.receive;
  if(other.id===id)fail('Choose another empire');
  if(!RESOURCE_KEYS.includes(resource)||!Number.isInteger(give)||give<1||give>500||!Number.isInteger(receive)||receive<1||receive>500)fail('Invalid trade amounts');
  const returnResource=cmd.returnResource;if(!RESOURCE_KEYS.includes(returnResource))fail('Invalid requested resource');
  if(!has(e,{[resource]:give}))fail('Insufficient offered resources');
  const offer={id:s.nextId++,kind:'trade',from:id,to:other.id,resource,give,returnResource,receive,until:s.time+180};s.offers.push(offer);log(s,e.name+' sent a trade offer to '+other.name);result.offer=offer.id;
 }else if(cmd.type==='acceptOffer'){
  const offer=s.offers.find(o=>o.id===cmd.offer&&o.to===id&&o.until>s.time);if(!offer)fail('Offer not available');
  const sender=who(s,offer.from);
  if(offer.kind==='pact'){
   if(!pact(s,id,sender.id))s.treaties.push({id:s.nextId++,a:id,b:sender.id,until:s.time+300,active:true});
   log(s,e.name+' and '+sender.name+' agreed to a 5-minute non-aggression pact');
  }else{
   if(!has(sender,{[offer.resource]:offer.give})||!has(e,{[offer.returnResource]:offer.receive}))fail('One empire cannot fulfill the trade');
   sender.resources[offer.resource]-=offer.give;e.resources[offer.resource]+=offer.give;
   e.resources[offer.returnResource]-=offer.receive;sender.resources[offer.returnResource]+=offer.receive;
   log(s,e.name+' and '+sender.name+' exchanged resources');
  }
  s.offers=s.offers.filter(o=>o.id!==offer.id);
 }else if(cmd.type==='breakPact'){
  const t=s.treaties.find(t=>t.id===cmd.treaty&&t.active&&(t.a===id||t.b===id));if(!t)fail('Active pact not found');
  t.active=false;e.reputation-=20;log(s,e.name+' broke a non-aggression pact');
 }else if(cmd.type==='recover'){
  if(s.systems.some(x=>x.owner===id))fail('You still control territory');
  if(s.time<e.recoveryReadyAt)fail('Recovery cooldown is still active');
  const target=s.systems.find(x=>x.owner===null);if(!target)fail('No unclaimed system available for recovery');
  target.owner=id;target.ships=2;target.level=1;target.buildings={mine:1,reactor:1,farm:1,shipyard:0,extractor:0};
  e.resources.credits=Math.max(e.resources.credits,100);e.resources.minerals=Math.max(e.resources.minerals,80);e.resources.alloys=Math.max(e.resources.alloys,30);
  e.recoveryReadyAt=s.time+600;log(s,e.name+' founded an exile recovery outpost on '+target.name);
 }else fail('Unsupported command');
 s.version++;return result;
}
function hopDuration(e){return e&&e.techs.includes('engines')?9:12;}
function income(s,e){const out={credits:0,minerals:0,alloys:0,energy:0,food:0,titanium:0,crystals:0,gas:0,science:0};
 for(const x of s.systems){if(x.owner!==e.id)continue;
  out.credits+=12+3*x.buildings.mine+4*(x.level-1);
  out.minerals+=8*x.buildings.mine*(e.techs.includes('industry')?1.5:1);
  out.energy+=7*x.buildings.reactor-2;out.food+=6*x.buildings.farm-2;
  out.alloys+=x.buildings.shipyard?4:1;
  out.science+=4+2*x.buildings.shipyard+2*(x.level-1);
  if(x.buildings.extractor)out[x.deposit]+=3*x.buildings.extractor;
 }
 if(e.techs.includes('logistics'))out.credits*=1.3;
 return out;
}
function arrival(s,f,at){
 const x=s.systems[at],attacker=f.owner,defender=x.owner;
 if(defender===attacker){x.ships+=f.ships;return;}
 if(defender===null){x.owner=attacker;x.ships=f.ships;log(s,attacker==='pirates'?'Pirates seized '+x.name:s.empires[attacker].name+' claimed '+x.name);return;}
 if(pact(s,attacker,defender)){const origin=s.systems[f.path[0]];if(origin.owner===attacker)origin.ships+=f.ships;return;}
 const tech=attacker==='pirates'?null:s.empires[attacker],defTech=defender==='pirates'?null:s.empires[defender];
 const atk=f.ships*(tech&&tech.techs.includes('weapons')?1.35:1);
 const defense=x.ships+1+(defTech&&defTech.techs.includes('shields')?4:0);
 if(atk>defense){x.owner=attacker;x.ships=Math.max(1,Math.floor(f.ships-defense/(atk/f.ships)));x.level=1;x.buildings={mine:0,reactor:0,farm:0,shipyard:0,extractor:0};
  s.jobs=s.jobs.filter(j=>j.system!==at);
  log(s,(attacker==='pirates'?'Pirates':tech.name)+' conquered '+x.name);
 }else{x.ships=Math.max(0,x.ships-Math.max(1,Math.floor(atk/2)));log(s,'Fleet assault on '+x.name+' was repelled');}
}
function tick(s,dt){if(!Number.isFinite(dt)||dt<=0) return;dt=Math.min(3600,dt);s.time+=dt;
 for(const e of Object.values(s.empires)){const gains=income(s,e);for(const [k,v] of Object.entries(gains)){
   if(k==='science')e.science+=v*dt/20;else e.resources[k]=Math.max(0,(e.resources[k]||0)+v*dt/20);
 }}
 const pending=[];for(const job of s.jobs){job.remaining-=dt;if(job.remaining>0){pending.push(job);continue;}
  const x=s.systems[job.system];if(x.owner!==job.owner)continue;
  if(job.type==='frigate')x.ships+=3;else if(job.type==='cruiser')x.ships+=5;else if(job.type==='upgrade')x.level=Math.min(4,x.level+1);else x.buildings[job.type]++;
  log(s,job.type+' finished at '+x.name,job.owner);
 }s.jobs=pending;
 const moving=[];for(const f of s.fleets){f.remaining-=dt;let finished=false;while(f.remaining<=0){
   f.hop++;if(f.hop>=f.path.length-1){arrival(s,f,f.path[f.path.length-1]);finished=true;break;}
   const e=s.empires[f.owner];f.hopTotal=hopDuration(e);f.remaining+=f.hopTotal;
 }if(!finished)moving.push(f);}s.fleets=moving;
 s.offers=s.offers.filter(o=>o.until>s.time);
 for(const treaty of s.treaties){if(treaty.active&&treaty.until<=s.time){treaty.active=false;log(s,'A non-aggression pact expired');}}
 s.aiClock+=dt;s.aiOrderClock+=dt;
 while(s.aiClock>=15){s.aiClock-=15;for(const x of s.systems.filter(x=>x.owner==='pirates'))x.ships+=2;}
 while(s.aiOrderClock>=35){s.aiOrderClock-=35;
  const pirate=s.systems.filter(x=>x.owner==='pirates'&&x.ships>=5).sort((a,b)=>b.ships-a.ships)[0];
  if(pirate){const candidates=adjacent(pirate.id).filter(n=>s.systems[n].owner!=='pirates');if(candidates.length){const target=candidates.find(n=>s.systems[n].owner===null)??candidates[0],ships=Math.max(3,Math.floor(pirate.ships/2));pirate.ships-=ships;s.fleets.push({id:s.nextId++,owner:'pirates',ships,path:[pirate.id,target],hop:0,remaining:12,hopTotal:12});log(s,'Pirate raiders launched toward '+s.systems[target].name);}}
 }
 s.version++;
}
function snapshot(s,id){
 const me=who(s,id),near=new Set();
 for(const sys of s.systems){if(sys.owner===id){near.add(sys.id);for(const n of adjacent(sys.id))near.add(n);}}
 const systems=s.systems.map(x=>near.has(x.id)?{...x,ships:x.owner===id?x.ships:(adjacent(x.id).some(n=>s.systems[n].owner===id)?x.ships:null),visible:true}:{id:x.id,name:x.name,x:x.x,y:x.y,visible:false,owner:null,deposit:null,ships:null,buildings:null,level:null});
 const fleets=s.fleets.filter(f=>f.owner===id||near.has(f.path[f.hop])||near.has(f.path[Math.min(f.hop+1,f.path.length-1)])).map(f=>({...f}));
 const empires=Object.values(s.empires).map(e=>({id:e.id,name:e.name,color:e.color,reputation:e.reputation,colonies:s.systems.filter(x=>x.owner===e.id).length}));
 return {version:s.version,time:s.time,you:{...me,resources:{...me.resources},techs:[...me.techs]},empires,systems,edges:EDGES,fleets,jobs:s.jobs.filter(j=>j.owner===id).map(j=>({...j})),offers:s.offers.filter(o=>o.from===id||o.to===id),treaties:s.treaties.filter(t=>t.a===id||t.b===id),events:s.events.filter(ev=>!ev.audience||ev.audience===id).slice(0,30),research:RESEARCH,costs:COSTS,income:income(s,me)};
}
module.exports={NAMES,EDGES,HOMES,RESEARCH,COSTS,newGalaxy,addEmpire,order,tick,snapshot,income,adjacent,path};
