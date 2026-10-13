'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Inline game script exists');
assert.ok(!html.includes('id="next"'),'Old End Turn button is removed');
assert.ok(html.includes('id="pause"')&&html.includes('id="speed"'),'RTS controls exist');

const elements=new Map();
function element(){return {
 textContent:'',innerHTML:'',style:{},className:'',value:'',attributes:{},children:[],
 classList:{add(){}},
 setAttribute(k,v){this.attributes[k]=v;},
 appendChild(c){this.children.push(c);return c;},
 replaceChildren(...children){this.children=children;},
 addEventListener(name,fn){this['on'+name]=fn;}
};}
const document={
 activeElement:null,
 getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},
 createElement:element,createElementNS:element
};
const store=new Map();let timer;
const context={
 document,
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
 confirm:()=>true,alert:()=>{},
 setInterval:fn=>{timer=fn;return 1;},
 window:{addEventListener(){}},
 console
};
vm.createContext(context);
const run=(code)=>vm.runInContext(code,context,{timeout:3000});
run(script);
assert.equal(typeof timer,'function','Automatic simulation timer installed');
assert.match(document.getElementById('turnLabel').textContent,/LIVE.*0:00/);
assert.ok(document.getElementById('construction'),'Construction queue panel exists');
assert.ok(document.getElementById('shared').children.length>0,'Shared-room experiment remains accessible');
assert.ok(document.getElementById('market').children.length>0,'Economy interface renders');
assert.equal(document.getElementById('forecast').children.length,9);
assert.equal(document.getElementById('objectives').children.length,7);
assert.equal(document.getElementById('empire').children.length,6);

const startingCredits=run('game.resources.credits');
const startingResearch=run('game.research');
run('stepSimulation(2)');
assert.equal(run('game.elapsedSeconds'),2);
assert.ok(run('game.resources.credits')>startingCredits,'Production flows without pressing a turn button');
assert.ok(run('game.research')>startingResearch,'Research flows without pressing a turn button');

run('paused=true;stepSimulation(3)');
assert.equal(run('game.elapsedSeconds'),2,'Pause halts simulation');
run('paused=false');
run('build("fleet")');
assert.equal(run('game.jobs.length'),1,'Fleet purchase enters a queue');
assert.equal(run('game.systems[0].ships'),3,'Ships are not built instantly');
for(let i=0;i<3;i++)run('stepSimulation(3)');
assert.equal(run('game.jobs.length'),0);
assert.equal(run('game.systems[0].ships'),5,'Shipbuilding finishes after nine game seconds');

run('selected=1;colonize();selected=0');
assert.equal(run('game.systems[1].owner'),'player');
run('game.research=200;researchTech("navigation")');
assert.equal(run('game.techs.includes("navigation")'),true);
run('send(2)');
assert.equal(run('game.fleets.some(f=>f.owner==="player")'),true);
assert.equal(run('fleetMarkerRefs.length')>0,true,'Fleet markers are created');
const startX=run('fleetMarkerRefs[0].circle.attributes.cx');
run('stepSimulation(1);updateFleetMarkers()');
assert.notEqual(run('fleetMarkerRefs[0].circle.attributes.cx'),startX,'Fleet marker moves during simulation');
for(let i=0;i<6;i++)run('stepSimulation(3)');
assert.equal(run('game.systems[2].owner'),'player','Fleet crosses multi-hop hyperlanes continuously');
assert.ok(run('game.systems.filter(s=>s.owner==="ai").length')>=1,'Autonomous AI remains active');

run('game.resources.credits=1000;game.resources.minerals=1000;game.resources.alloys=1000');
run('upgradeColony()');
assert.ok(run('game.jobs.some(j=>j.type==="upgrade")'),'Colony improvement has a timer');
for(let i=0;i<9;i++)run('stepSimulation(3)');
assert.equal(run('game.systems[0].level'),2);

const beforeMarket=run('game.resources.minerals');
run('trade("buy","minerals")');
assert.equal(run('game.resources.minerals'),beforeMarket+5);
run('trade("sell","minerals")');
assert.equal(run('game.resources.minerals'),beforeMarket);

run('game.resources.credits=500;game.resources.gas=10;negotiate()');
assert.equal(run('game.relations'),'Ceasefire');
assert.ok(run('game.ceasefireEndsAt')>run('game.elapsedSeconds'));
run('resolveArrival({owner:"player",ships:40,path:[0,4],step:0,progress:0},4)');
assert.equal(run('game.systems[4].owner'),'ai','Ceasefire prevents in-flight attacks');

const sharedChildren=document.getElementById('shared').children;
run('render()');
assert.equal(document.getElementById('shared').children[1],sharedChildren[1],'Room URL input persists across repaint');

run('const legacy=JSON.parse(JSON.stringify(game));delete legacy.elapsedSeconds;delete legacy.ceasefireEndsAt;delete legacy.jobs;legacy.turn=4;legacy.ceasefireUntil=6;delete legacy.systems[0].level;normalizeGame(legacy);');
assert.equal(run('legacy.elapsedSeconds'),60,'Turn-era saves migrate into elapsed seconds');
assert.equal(run('legacy.ceasefireEndsAt'),100,'Legacy ceasefires migrate into time-based expiry');
assert.equal(run('legacy.systems[0].level'),1);
assert.equal(run('legacy.jobs.length'),0);

run('game=initial();selected=0;');
for(let i=0;i<45;i++)run('stepSimulation(3)');
assert.equal(run('game.systems.filter(s=>s.owner==="ai").length'),1,'Normal AI does not expand during its opening grace period');
assert.ok(run('game.systems[4].ships')<=30,'AI garrison production is capped');
assert.ok(html.includes('id="soloTitle"')&&html.includes('id="soloPlanet"'),'Single-player title and planet screens exist');
assert.ok(html.includes('src="multiplayer/planet3d.js"'),'Single-player shares multiplayer 3D viewer');
assert.equal(run('SOLO_DISTRICTS.length'),10,'Ten interactive planetary districts exist');
run('game.resources.credits=1000;game.resources.minerals=1000;game.resources.alloys=1000;game.resources.energy=1000;game.resources.crystals=1000;game.resources.gas=1000;selected=0;');
const beforeFoundry=run('game.systems[0].foundry');
run('build("foundry")');
assert.ok(run('game.jobs.some(j=>j.type==="foundry")'),'Foundry is queued in solo simulation');
for(let i=0;i<7;i++)run('stepSimulation(3)');
assert.equal(run('game.systems[0].foundry'),beforeFoundry+1,'Foundry construction completes');
assert.ok(run('productionForecast().alloys')>0,'Foundry produces alloys');
run('build("laboratory")');
assert.ok(run('game.jobs.some(j=>j.type==="laboratory")'),'Advanced level-two district can be built');
for(let i=0;i<8;i++)run('stepSimulation(3)');
assert.ok(run('game.systems[0].laboratory')>=1,'Laboratory completes');
assert.ok(run('productionForecast().research')>=13,'Laboratory produces science');
run('game=initial();selected=0;game.resources.credits=1000;game.resources.food=1000;game.resources.alloys=1000;');
run('build("troops")');
assert.ok(run('game.jobs.some(j=>j.type==="troops")'),'Troops can be trained at a shipyard');
for(let i=0;i<4;i++)run('stepSimulation(3)');
assert.equal(run('game.systems[0].troops'),5,'Training produces five troops');
run('game.systems[0].ships=10;send(1)');
assert.equal(run('game.fleets[0].troops'),5,'Troops travel with assault fleets');
assert.equal(run('game.systems[0].troops'),0,'Dispatched troops leave the colony');
assert.ok(html.includes('⚔ Attack '),'Explicit AI attack buttons exist');
run('game=initial();selected=0;');
assert.equal(run('game.resources.credits'),145,'Starting credits are reduced');
assert.equal(run('productionForecast().credits'),6,'Starting colony earns six credits per economy cycle');
assert.equal(run('Object.keys(MARKET_BASE).includes("copper")&&Object.keys(MARKET_BASE).includes("nickel")&&Object.keys(MARKET_BASE).includes("tungsten")'),true,'Three new metals are tradable');
assert.equal(run('RESOURCE_DEPOSITS.Arid'),'copper','Arid planets contain copper');
assert.equal(run('RESOURCE_DEPOSITS.Frozen'),'nickel','Frozen planets contain nickel');
assert.equal(run('RESOURCE_DEPOSITS.Tundra'),'tungsten','Tundra planets contain tungsten');
run('game.systems[0].environment="Arid";game.systems[0].extractors=2;');
assert.ok(run('productionForecast().copper')>7,'Rich copper deposits produce more than standard deposits');
run('const oldSave=initial();delete oldSave.resources.copper;delete oldSave.resources.nickel;delete oldSave.resources.tungsten;normalizeGame(oldSave);');
assert.equal(run('oldSave.resources.copper'),0,'Older saves migrate to new metal resources');
run('game=initial();selected=0;');
assert.ok(run('game.systems.every((sys,i)=>sys.depositRemaining===depositProfile(sys,i).capacity)'),'New planets start with finite reserves');
assert.ok(run('depositProfile(game.systems[0],0).grade')==='rich','Deposit quality is deterministic');
run('game.systems[0].extractors=2;');
const oreBefore=run('game.systems[0].depositRemaining');
run('stepSimulation(3)');
assert.ok(run('game.systems[0].depositRemaining')<oreBefore,'Extraction consumes reserves');
run('game.systems[0].depositRemaining=0;');
assert.equal(run('productionForecast().crystals'),0,'Exhausted deposits stop strategic resource output');
run('const migrated=initial();delete migrated.systems[0].depositRemaining;normalizeGame(migrated);');
assert.ok(run('migrated.systems[0].depositRemaining')>0,'Older saves receive finite reserve values');
assert.ok(store.has('starfall-dominion-rts-v42'),'Real-time save key is present');
assert.ok(html.includes('Shared Galaxy Lab'),'Experimental rooms remain explicitly separate from live multiplayer');
console.log('PASS: real-time economy, paused simulation, timed construction, live fleet travel, AI, research, diplomacy, trade, saves and UI');
