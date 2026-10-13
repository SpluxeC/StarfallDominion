'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const engine=require('../multiplayer/engine.cjs');
const {createServer}=require('../multiplayer/server.cjs');
const ids=['0123456789abcdef','fedcba9876543210','0011223344556677','8899aabbccddeeff'];
test('four players get independent empires and a fifth cannot join',()=>{
 const galaxy=engine.newGalaxy();
 for(let i=0;i<4;i++)engine.addEmpire(galaxy,ids[i],'Commander'+i);
 assert.equal(Object.keys(galaxy.empires).length,4);
 assert.deepEqual(engine.HOMES.map(i=>galaxy.systems[i].owner),ids);
 assert.throws(()=>engine.addEmpire(galaxy,'abababababababab','Extra'),/full/);
});
test('owned construction queues finish automatically as the world progresses',()=>{
 const state=engine.newGalaxy(),a=engine.addEmpire(state,ids[0],'Alpha');
 const start=a.resources.credits;
 const job=engine.order(state,a.id,{type:'build',system:0,building:'mine'});assert.ok(job.job);
 assert.equal(state.systems[0].buildings.mine,1);
 engine.tick(state,13);assert.equal(state.systems[0].buildings.mine,2);
 assert.equal(state.jobs.length,0);
 assert.ok(a.resources.credits>start-30,'Economy produces continuously while jobs run');
 assert.throws(()=>engine.order(state,a.id,{type:'build',system:5,building:'mine'}),/do not control/);
});
test('fleets travel in real time, capture neutral systems, then reveal adjoining stars',()=>{
 const s=engine.newGalaxy(),a=engine.addEmpire(s,ids[0],'Alpha');
 const f=engine.order(s,a.id,{type:'fleet',from:0,to:1,ships:3});assert.ok(f.fleet);
 engine.tick(s,6);assert.equal(s.systems[1].owner,null);
 assert.equal(s.fleets.length,1);
 engine.tick(s,7);assert.equal(s.systems[1].owner,a.id);
 const view=engine.snapshot(s,a.id);assert.equal(view.systems[2].visible,true);
 assert.equal(view.systems[16].visible,false);
});
test('research, diplomacy, atomic trading and treaty penalties are enforced',()=>{
 const s=engine.newGalaxy(),a=engine.addEmpire(s,ids[0],'Alpha'),b=engine.addEmpire(s,ids[1],'Beta');
 engine.tick(s,400);
 engine.order(s,a.id,{type:'research',tech:'engines'});
 assert.ok(a.techs.includes('engines'));
 const p=engine.order(s,a.id,{type:'offerPact',target:b.id});
 engine.order(s,b.id,{type:'acceptOffer',offer:p.offer});
 assert.equal(s.treaties.filter(t=>t.active).length,1);
 s.systems[2].owner=a.id;s.systems[2].ships=5;s.systems[3].owner=b.id;
 assert.throws(()=>engine.order(s,a.id,{type:'fleet',from:2,to:3,ships:2}),/pact/);
 const beforeA=a.resources.food,beforeB=b.resources.minerals;
 const offer=engine.order(s,a.id,{type:'offerTrade',target:b.id,resource:'food',give:10,returnResource:'minerals',receive:7});
 engine.order(s,b.id,{type:'acceptOffer',offer:offer.offer});
 assert.equal(a.resources.food,beforeA-10);assert.equal(b.resources.minerals,beforeB-7);
 engine.order(s,a.id,{type:'breakPact',treaty:s.treaties[0].id});assert.equal(a.reputation,-20);
});
test('exiled player can recover and keep its identity',()=>{
 const s=engine.newGalaxy(),a=engine.addEmpire(s,ids[0],'Alpha');
 s.systems[0].owner='pirates';s.systems[0].ships=0;
 engine.order(s,a.id,{type:'recover'});
 assert.equal(Object.keys(s.empires).length,1);
 assert.equal(s.systems.filter(x=>x.owner===a.id).length,1);
 assert.ok(a.recoveryReadyAt>0);
});
test('recovery flotilla remains possible when there are no neutral systems',()=>{
 const s=engine.newGalaxy(),a=engine.addEmpire(s,ids[0],'Exile');
 for(const x of s.systems){x.owner='pirates';x.ships=1;}
 engine.order(s,a.id,{type:'recover'});
 assert.equal(s.fleets.length,1,'A recovery flotilla launches instead of deleting the player');
 assert.equal(s.fleets[0].owner,a.id);
 engine.tick(s,16);
 assert.ok(s.systems.some(x=>x.owner===a.id),'Recovery flotilla can establish new territory');
});
test('private events and distant territorial changes are obscured by fog',()=>{
 const s=engine.newGalaxy(),a=engine.addEmpire(s,ids[0],'Alpha'),b=engine.addEmpire(s,ids[1],'Beta');
 engine.order(s,b.id,{type:'fleet',from:5,to:4,ships:2});
 const view=engine.snapshot(s,a.id);
 assert.ok(!view.events.some(ev=>ev.message.includes('dispatched')&&ev.message.includes('Kestrel')),'Enemy orders are not public intelligence');
 assert.equal(view.systems[5].visible,false);
});
test('advanced colony buildings produce bonuses and enforce planet prerequisites',()=>{
 const s=engine.newGalaxy(),a=engine.addEmpire(s,ids[0],'Builder');
 a.resources={credits:10000,minerals:10000,alloys:10000,energy:10000,food:10000,titanium:10000,crystals:10000,gas:10000};
 assert.throws(()=>engine.order(s,a.id,{type:'build',system:0,building:'fortress'}),/level 2/);
 engine.order(s,a.id,{type:'build',system:0,building:'foundry'});
 engine.order(s,a.id,{type:'build',system:0,building:'tradeHub'});
 engine.tick(s,30);
 assert.equal(s.systems[0].buildings.foundry,1);
 assert.equal(s.systems[0].buildings.tradeHub,1);
 assert.ok(engine.income(s,a).alloys>=11);
 assert.ok(engine.income(s,a).credits>=25);
 engine.order(s,a.id,{type:'build',system:0,building:'upgrade'});
 engine.tick(s,30);
 assert.equal(s.systems[0].level,2);
 engine.order(s,a.id,{type:'build',system:0,building:'fortress'});
 engine.order(s,a.id,{type:'build',system:0,building:'laboratory'});
 assert.throws(()=>engine.order(s,a.id,{type:'build',system:0,building:'refinery'}),/gas deposit/);
 engine.tick(s,30);
 assert.equal(s.systems[0].buildings.fortress,1);
 assert.equal(s.systems[0].buildings.laboratory,1);
 assert.ok(engine.income(s,a).science>=15);
});
test('client source has live updates, authenticated commands and no turn button',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../multiplayer/index.html'),'utf8');
 assert.match(html,/api\/events/);assert.match(html,/api\/command/);
 assert.match(html,/Authorization/);assert.doesNotMatch(html,/End Turn/);
});
test('title scene and planetary construction UI expose all building districts and queue progress',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../multiplayer/index.html'),'utf8');
 assert.match(html,/id="titleScreen"/);
 assert.match(html,/id="titlePlay"/);
 assert.match(html,/id="titleContinue"/);
 assert.match(html,/id="planetScreen"/);
 assert.match(html,/id="planetSlots"/);
 assert.match(html,/id="planetCatalog"/);
 assert.match(html,/id="planetJobs"/);
 assert.match(html,/function openPlanet\(/);
 assert.match(html,/function renderPlanet\(/);
 assert.match(html,/role','progressbar'/);
 for(const type of ['mine','reactor','farm','shipyard','extractor','foundry','laboratory','tradeHub','fortress','refinery']){
  assert.match(html,new RegExp("type:'"+type+"'"),type+' district is listed');
 }
 const script=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(script,'client script exists');
 assert.doesNotThrow(()=>new Function(script[1]),'client script compiles');
});
test('HTTP server enforces invitations, bearer authorization, scoped empires, SSE, and restart persistence',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starfall-mp-'));
 const file=path.join(dir,'galaxy.json');
 const app=createServer({file,invite:'friends-only',tickMs:100});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 const headers={'Content-Type':'application/json'};
 const post=(url,body,token)=>fetch(base+url,{method:'POST',headers:{...headers,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
 let tokenA,tokenB,streamReader;
 try{
  const health=await(await fetch(base+'/api/health')).json();assert.equal(health.simulation,'realtime');
  const sameOrigin=await fetch(base+'/api/health',{headers:{Origin:base}});assert.equal(sameOrigin.status,200,'Same-origin browser requests are allowed');
  const hostileOrigin=await fetch(base+'/api/health',{headers:{Origin:'https://untrusted.invalid'}});assert.equal(hostileOrigin.status,403,'Unapproved origins are rejected');
  const forbidden=await post('/api/join',{name:'Alpha',invite:'wrong'});assert.equal(forbidden.status,403);
  const created=await post('/api/join',{name:'Alpha',invite:'friends-only'});assert.equal(created.status,201);
  const joined=await created.json();tokenA=joined.token;
  assert.equal(tokenA.length,64);assert.equal(joined.galaxy.you.name,'Alpha');
  const second=await(await post('/api/join',{name:'Beta',invite:'friends-only'})).json();tokenB=second.token;
  const unauth=await fetch(base+'/api/state');assert.equal(unauth.status,401);
  const clientA=await(await fetch(base+'/api/state',{headers:{Authorization:'Bearer '+tokenA}})).json();
  const clientB=await(await fetch(base+'/api/state',{headers:{Authorization:'Bearer '+tokenB}})).json();
  assert.notEqual(clientA.you.id,clientB.you.id);
  assert.equal(clientA.systems[5].visible,false,'Other empires not visible through fog');
  assert.equal(clientA.you.resources.credits,220);
  const spoof=await post('/api/command',{type:'build',system:5,building:'mine',owner:clientB.you.id},tokenA);
  assert.equal(spoof.status,400,'Server rejects forged ownership');
  const buy=await post('/api/command',{type:'build',system:0,building:'mine'},tokenA);assert.equal(buy.status,200);
  app.advance(14);
  const stateA=await(await fetch(base+'/api/state',{headers:{Authorization:'Bearer '+tokenA}})).json();
  assert.equal(stateA.systems[0].buildings.mine,2);
  assert.ok(stateA.time>=14);
  const controller=new AbortController();
  const stream=await fetch(base+'/api/events',{headers:{Authorization:'Bearer '+tokenA},signal:controller.signal});
  assert.equal(stream.status,200);assert.match(stream.headers.get('content-type'),/text\/event-stream/);
  streamReader=stream.body.getReader();const frame=await streamReader.read();
  assert.match(Buffer.from(frame.value).toString('utf8'),/event: snapshot/);
  controller.abort();await streamReader.cancel().catch(()=>{});streamReader=null;
 }finally{
  if(streamReader)await streamReader.cancel().catch(()=>{});
  await new Promise((resolve,reject)=>app.server.close(err=>err?reject(err):resolve()));
 }
 assert.ok(fs.existsSync(file),'Galaxy is persisted on disk');
 const onDisk=JSON.parse(fs.readFileSync(file,'utf8'));
 assert.ok(!JSON.stringify(onDisk).includes(tokenA),'Raw login token is not stored on disk');
 const restored=createServer({file,invite:'friends-only',tickMs:100});
 await new Promise(resolve=>restored.server.listen(0,'127.0.0.1',resolve));
 try{
  assert.equal(Object.keys(restored.getState().empires).length,2);
  const res=await fetch('http://127.0.0.1:'+restored.server.address().port+'/api/state',{headers:{Authorization:'Bearer '+tokenA}});
  assert.equal(res.status,200,'Token survives restart and grants the same player');
 }finally{await new Promise(resolve=>restored.server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
});
