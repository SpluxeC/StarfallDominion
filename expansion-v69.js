/* Starfall Dominion expansion systems — economy, rival AI and research.
   Deterministic simulation rules, compatible with existing saves and fleet combat. */
'use strict';
const StarfallExpansion=(()=>{
 const PERSONALITIES=Object.freeze({
  expansionist:{label:'Expansionist',growth:1.15,aggression:1.35,fortify:0.65},
  militarist:{label:'Militarist',growth:1.25,aggression:1.8,fortify:0.9},
  industrialist:{label:'Industrialist',growth:1.55,aggression:0.75,fortify:1.25},
  sentinel:{label:'Sentinel',growth:0.95,aggression:0.65,fortify:1.8}
 });
 const TECHS=[
  {id:'prospecting',name:'Deep Core Prospecting',branch:'Economy',requires:['industry'],cost:125,description:'+25% mine output and strategic deposit yield'},
  {id:'fusion',name:'Fusion Grid',branch:'Economy',requires:['industry'],cost:145,description:'+35% reactor energy output'},
  {id:'commerce',name:'Interstellar Commerce',branch:'Economy',requires:['logistics'],cost:150,description:'+30% colony credits and trade income'},
  {id:'academies',name:'Research Academies',branch:'Science',requires:['prospecting'],cost:170,description:'+35% ongoing research production'},
  {id:'advancedweapons',name:'Railgun Arrays',branch:'Military',requires:['weapons'],cost:175,description:'+25% fleet weapon damage'},
  {id:'reinforcedhulls',name:'Reinforced Hulls',branch:'Military',requires:['defense'],cost:155,description:'+20% ship durability in battles'},
  {id:'carrierlogistics',name:'Fleet Logistics',branch:'Military',requires:['navigation'],cost:160,description:'+20% shipyard capacity and +25% cargo space'},
  {id:'commandnet',name:'Command Network',branch:'Military',requires:['advancedweapons','carrierlogistics'],cost:260,description:'+20% fleet firepower and faster fleet travel'},
  {id:'terraforming',name:'Planetary Engineering',branch:'Economy',requires:['fusion','commerce'],cost:245,description:'+20% food production and improved population support'}
 ];
 const int=n=>Number.isFinite(Number(n))?Math.max(0,Math.floor(Number(n))):0;
 function ensure(game){
  if(!Array.isArray(game.techs))game.techs=[];
  if(!game.aiStrategy||!PERSONALITIES[game.aiStrategy.personality]){
   const options=Object.keys(PERSONALITIES);
   const seed=int(game.systems?.findIndex(s=>s.owner==='ai'))+int(game.battles||0);
   game.aiStrategy={personality:options[seed%options.length],relations:-35,policy:'hostile',lastRaidAt:-999};
  }
  const ai=game.aiStrategy;
  ai.relations=Math.max(-100,Math.min(100,Number.isFinite(ai.relations)?ai.relations:-35));
  if(!['hostile','neutral','truce'].includes(ai.policy))ai.policy='hostile';
  if(!Number.isFinite(ai.lastRaidAt))ai.lastRaidAt=-999;
  for(const system of game.systems||[]){
   if(!system.specialization)system.specialization='balanced';
   if(!Number.isFinite(system.prosperity))system.prosperity=50;
   system.prosperity=Math.max(0,Math.min(100,system.prosperity));
  }
  return ai;
 }
 function canResearch(id,owned){
  const tech=TECHS.find(t=>t.id===id);
  return !!tech&&tech.requires.every(r=>owned.includes(r));
 }
 function environmentMultiplier(system,key){
  const env=system.environment;
  if(key==='minerals')return ['Volcanic','Barren','Arid'].includes(env)?1.2:1;
  if(key==='energy')return env==='Volcanic'||env==='Gas-rich'?1.2:1;
  if(key==='food')return env==='Temperate'||env==='Jungle'||env==='Oceanic'?1.25:env==='Barren'?0.8:1;
  if(key==='research')return env==='Frozen'||env==='Tundra'?1.1:1;
  return 1;
 }
 function economyBonus(system,key,techs=[]){
  let factor=environmentMultiplier(system,key);
  if(key==='minerals'&&techs.includes('prospecting'))factor*=1.25;
  if(key==='energy'&&techs.includes('fusion'))factor*=1.35;
  if(key==='food'&&techs.includes('terraforming'))factor*=1.2;
  if(key==='credits'&&techs.includes('commerce'))factor*=1.3;
  if(key==='research'&&techs.includes('academies'))factor*=1.35;
  if(key==='credits')factor*=0.8+Math.max(0,Math.min(100,system.prosperity??50))/250;
  return factor;
 }
 function updateProsperity(game,dt){
  for(const s of game.systems){
   if(s.owner!=='player')continue;
   const sustainable=(s.farms||0)>0&&(s.reactors||0)>0;
   const trade=(s.tradeHub||0)*0.015+(s.outpost||0)*0.004;
   const direction=sustainable?0.035:-0.045;
   s.prosperity=Math.min(100,Math.max(0,(s.prosperity??50)+(direction+trade)*dt));
  }
 }
 function aiDevelop(game,adjacent){
  const state=ensure(game),p=PERSONALITIES[state.personality];
  const systems=game.systems;
  const aiSystems=systems.map((s,i)=>s.owner==='ai'?{s,i}:null).filter(Boolean);
  for(const {s,i} of aiSystems){
   if((s.shipyards||0)<1)s.shipyards=1;
   const shipCap=10+25*(s.shipyards||0);
   const strength=game.difficulty==='hard'?1.5:game.difficulty==='easy'?0.75:1;
   s.ships=Math.min(shipCap,(s.ships||0)+Math.max(1,Math.floor(2*strength*p.growth)));
   if((s.mines||0)<2&&game.elapsedSeconds%130<10)s.mines++;
   if((s.reactors||0)<1&&game.elapsedSeconds%200<10)s.reactors++;
   if((s.shipyards||0)<3&&s.ships>=shipCap-5)s.shipyards++;
   if((s.fortress||0)<3&&game.elapsedSeconds%180<10&&p.fortify>=1.1)s.fortress++;
   if(s.ships>=8&&!(s.frigates||0)&&game.elapsedSeconds>140)s.frigates=1;
   if(s.ships>=17&&!(s.cruisers||0)&&game.elapsedSeconds>340)s.cruisers=1;
   s.frigates=Math.min(s.ships,s.frigates||0);s.cruisers=Math.min(s.ships-s.frigates,s.cruisers||0);
  }
 }
 function aiTarget(game,adjacent){
  const ai=ensure(game),p=PERSONALITIES[ai.personality];
  if(game.elapsedSeconds<(game.ceasefireEndsAt||0)||ai.policy==='truce')return null;
  const difficulty=game.difficulty==='hard'?0.8:game.difficulty==='easy'?1.5:1;
  const entries=[];
  for(let i=0;i<game.systems.length;i++){
   const source=game.systems[i];if(source.owner!=='ai'||source.ships<5)continue;
   for(const j of adjacent(i)){
    const target=game.systems[j];if(target.owner==='ai')continue;
    const attack=source.ships*0.6;
    const defense=(target.ships||0)+2*(target.fortress||0)+(target.troops||0)*0.05;
    const isEnemy=target.owner==='player';
    if(isEnemy&&game.elapsedSeconds-(game.aiExpansionStartedAt||0)<140*difficulty)continue;
    if(isEnemy&&attack<defense*(1.05/p.aggression)*difficulty)continue;
    const score=(isEnemy?6*p.aggression:13)+Math.max(0,attack-defense)*0.7+(p.fortify>1.4?-4:0);
    entries.push({from:i,to:j,score});
   }
  }
  entries.sort((a,b)=>b.score-a.score||a.from-b.from||a.to-b.to);
  return entries[0]||null;
 }
 function diplomacy(game,action){
  const ai=ensure(game);
  if(action==='improve'){
   if(game.resources.credits<80||game.resources.crystals<2)return {ok:false,message:'Improving relations costs 80 credits and 2 crystals.'};
   game.resources.credits-=80;game.resources.crystals-=2;ai.relations=Math.min(100,ai.relations+25);
   if(ai.relations>=0)ai.policy='neutral';
   return {ok:true,message:'Diplomatic envoys improved relations to '+ai.relations+'.'};
  }
  if(action==='provoke'){
   ai.relations=Math.max(-100,ai.relations-25);ai.policy='hostile';
   return {ok:true,message:'Relations deteriorated to '+ai.relations+'.'};
  }
  if(action==='truce'){
   if(ai.relations<0)return {ok:false,message:'Rival relations must reach 0 before a treaty can be signed.'};
   if(game.resources.credits<100)return {ok:false,message:'A treaty requires 100 credits.'};
   game.resources.credits-=100;ai.policy='truce';game.ceasefireEndsAt=Math.max(game.ceasefireEndsAt||0,game.elapsedSeconds+240);
   return {ok:true,message:'A 240-second ceasefire treaty is now in effect.'};
  }
  return {ok:false,message:'Unknown diplomacy action.'};
 }
 return Object.freeze({PERSONALITIES,TECHS,ensure,canResearch,economyBonus,updateProsperity,aiDevelop,aiTarget,diplomacy});
})();
