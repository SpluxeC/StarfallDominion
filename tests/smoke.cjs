const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Inline game script exists');
const elements=new Map();
function element(){return {textContent:'',innerHTML:'',style:{},className:'',classList:{add(){}},children:[],setAttribute(){},appendChild(c){this.children.push(c);return c;},replaceChildren(...c){this.children=c;},addEventListener(){}};}
const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,createElementNS:element};
const store=new Map();
const context={document,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},confirm:()=>true,console,Set,Math,JSON,Array,Object,Number};
vm.createContext(context);vm.runInContext(script,context,{timeout:3000});
assert.match(document.getElementById('turnLabel').textContent,/Turn 1/);
assert.ok(document.getElementById('actions').children.length>0);
assert.ok(document.getElementById('objectives').children.length===7);
assert.ok(document.getElementById('research').children.length>0);
vm.runInContext('nextTurn()',context,{timeout:3000});
assert.match(document.getElementById('turnLabel').textContent,/Turn 2/);
vm.runInContext('selected=1;colonize()',context,{timeout:3000});
assert.equal(vm.runInContext('game.systems[1].owner',context),'player');
vm.runInContext('selected=0;build("fleet")',context,{timeout:3000});
assert.ok(vm.runInContext('game.systems[0].ships',context)>=5);
vm.runInContext('game.research=200;researchTech("navigation")',context,{timeout:3000});
assert.equal(vm.runInContext('game.techs.includes("navigation")',context),true);
vm.runInContext('send(2)',context,{timeout:3000});
assert.ok(vm.runInContext('game.fleets.length',context)>0);
assert.ok(store.has('starfall-dominion-v40'));
vm.runInContext('game.resources.credits=500;game.resources.minerals=500;trade("buy","titanium")',context,{timeout:3000});
assert.equal(vm.runInContext('game.resources.titanium',context),21);
vm.runInContext('selected=0;upgradeColony()',context,{timeout:3000});
assert.equal(vm.runInContext('game.systems[0].level',context),2);

assert.equal(vm.runInContext('game.resources.titanium',context),16);
assert.equal(vm.runInContext('game.resources.crystals',context),12);
assert.equal(vm.runInContext('game.resources.gas',context),8);
vm.runInContext('selected=0;build("extractor")',context,{timeout:3000});
assert.equal(vm.runInContext('game.systems[0].extractors',context),1);
const crystalsBefore=vm.runInContext('game.resources.crystals',context);
vm.runInContext('nextTurn()',context,{timeout:3000});
assert.equal(vm.runInContext('game.resources.crystals',context),crystalsBefore+3);

assert.ok(document.getElementById('export'));
assert.ok(document.getElementById('import'));
assert.ok(document.getElementById('importFile'));
assert.ok(document.getElementById('empire').children.length===6);
assert.ok(document.getElementById('forecast').children.length===9);
assert.ok(document.getElementById('market').children.length>=4);
assert.ok(document.getElementById('shared').children.length>=4);
assert.equal(vm.runInContext('game.systems[0].level',context),1);

assert.ok(document.getElementById('intel'));
assert.ok(html.includes('Galaxy map legend'));
assert.ok(html.includes('star-halo'));
assert.ok(html.includes('prefers-reduced-motion'));
assert.equal(vm.runInContext('productionForecast().credits',context),31);
vm.runInContext('game.difficulty="hard";aiTurn()',context,{timeout:3000});
assert.equal(vm.runInContext('game.difficulty',context),'hard');
assert.ok(document.getElementById('help'));
assert.ok(document.getElementById('tutorial'));


assert.ok(document.getElementById('diplomacy').children.length>0);
vm.runInContext('game.resources.credits=200;negotiate()',context,{timeout:3000});
assert.equal(vm.runInContext('game.relations',context),'Ceasefire');
assert.ok(vm.runInContext('game.ceasefireUntil',context)>2);
vm.runInContext('game.systems[4].ships=0;resolveArrival({owner:"player",ships:20,path:[0,4],step:0},4)',context,{timeout:3000});
assert.equal(vm.runInContext('game.systems[4].owner',context),'ai','Ceasefire prevents in-flight attacks');

console.log('PASS: initial render, objectives, research UI, turn, colonization, fleet building, research, movement, persistence');
