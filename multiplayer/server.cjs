'use strict';
/* Real-time authoritative multiplayer prototype. Requires a running Node.js host and durable storage. */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const rules=require('./engine.cjs');
const CLIENT=path.join(__dirname,'index.html');
const HEADER_LIMIT=12000;
function hash(token){return crypto.createHash('sha256').update(token).digest('hex');}
function readJson(req,max=HEADER_LIMIT){return new Promise((resolve,reject)=>{
 let raw='',ended=false;
 req.on('data',chunk=>{raw+=chunk;if(raw.length>max&&!ended){ended=true;reject(Object.assign(new Error('Request too large'),{status:413}));req.destroy();}});
 req.on('end',()=>{if(ended)return;try{resolve(raw?JSON.parse(raw):{});}catch{reject(Object.assign(new Error('Malformed JSON'),{status:400}));}});
 req.on('error',reject);
});}
function createServer(options={}){
 const file=options.file===undefined?(process.env.STARFALL_DATA_PATH||path.join(__dirname,'data','galaxy.json')):options.file;
 const invite=options.invite===undefined?(process.env.STARFALL_INVITE_CODE||''):options.invite;
 const tickMs=options.tickMs||1000;
 const origins=(process.env.ALLOWED_ORIGINS||'https://spluxec.github.io').split(',').map(x=>x.trim());
 let galaxy=rules.newGalaxy(),sessions={},savedWall=Date.now(),clock=Date.now(),dirty=false;
 if(file&&fs.existsSync(file)){
  const loaded=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!loaded||!loaded.galaxy||!loaded.sessions||!Array.isArray(loaded.galaxy.systems)||loaded.galaxy.systems.length!==rules.NAMES.length)throw Error('Invalid galaxy persistence file');
  galaxy=loaded.galaxy;sessions=loaded.sessions;savedWall=Number(loaded.savedWall)||Date.now();clock=Date.now();
  const downtime=Math.max(0,Math.min(3600,(clock-savedWall)/1000));
  for(let t=0;t<downtime;t+=5)rules.tick(galaxy,Math.min(5,downtime-t));
  dirty=true;
 }
 const streams=new Map(),recent=new Map();
 function persist(){
  if(!file)return;
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+'.'+process.pid+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify({galaxy,sessions,savedWall:Date.now()}),{mode:0o600});
  fs.renameSync(tmp,file);dirty=false;
 }
 function allowed(origin){if(!origin)return true;if(origins.includes(origin))return true;
  try{const u=new URL(origin);return (u.hostname==='localhost'||u.hostname==='127.0.0.1')&&['http:','https:'].includes(u.protocol);}catch{return false;}
 }
 function cors(req,res){
  const origin=req.headers.origin;
  if(origin&&!allowed(origin))return false;
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-Requested-With');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  return true;
 }
 function reply(res,status,payload){if(res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));}
 function authenticate(req){const header=req.headers.authorization||'';
  if(!/^Bearer [a-f0-9]{64}$/.test(header))return null;
  const userId=sessions[hash(header.slice(7))];return userId&&galaxy.empires[userId]?userId:null;
 }
 function broadcast(){
  for(const [res,id] of streams.entries()){
   if(res.writableEnded||res.destroyed){streams.delete(res);continue;}
   try{res.write('event: snapshot\ndata: '+JSON.stringify(rules.snapshot(galaxy,id))+'\n\n');}
   catch{streams.delete(res);try{res.end();}catch{}}
  }
 }
 function advance(seconds){if(!Number.isFinite(seconds)||seconds<=0)return;for(let t=0;t<seconds;t+=1)rules.tick(galaxy,Math.min(1,seconds-t));dirty=true;broadcast();}
 const server=http.createServer(async(req,res)=>{
  if(!cors(req,res))return reply(res,403,{error:'Origin is not allowed'});
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  const url=new URL(req.url,'http://localhost');
  try{
   if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/multiplayer/'||url.pathname==='/index.html')){
    const html=fs.readFileSync(CLIENT);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"});return res.end(html);
   }
   if(req.method==='GET'&&url.pathname==='/api/health')return reply(res,200,{ok:true,simulation:'realtime',galaxyTime:Math.floor(galaxy.time),players:Object.keys(galaxy.empires).length,capacity:4});
   if(req.method==='POST'&&url.pathname==='/api/join'){
    const body=await readJson(req);if(invite&&body.invite!==invite)return reply(res,403,{error:'Invalid invitation code'});
    const name=String(body.name||'').trim().slice(0,24);
    if(!/^[\p{L}\p{N} _-]{2,24}$/u.test(name))return reply(res,400,{error:'Commander name must be 2–24 letters or digits'});
    const token=crypto.randomBytes(32).toString('hex'),id=crypto.randomBytes(8).toString('hex');
    rules.addEmpire(galaxy,id,name);sessions[hash(token)]=id;dirty=true;persist();broadcast();
    return reply(res,201,{token,empireId:id,galaxy:rules.snapshot(galaxy,id)});
   }
   const id=authenticate(req);if(!id)return reply(res,401,{error:'Missing or invalid player token'});
   if(req.method==='GET'&&url.pathname==='/api/state')return reply(res,200,rules.snapshot(galaxy,id));
   if(req.method==='GET'&&url.pathname==='/api/events'){
    let ownStreams=0;for(const value of streams.values())if(value===id)ownStreams++;
    if(ownStreams>=3)return reply(res,429,{error:'Too many active streams'});
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    streams.set(res,id);
    res.write('retry: 2000\nevent: snapshot\ndata: '+JSON.stringify(rules.snapshot(galaxy,id))+'\n\n');
    req.on('close',()=>streams.delete(res));return;
   }
   if(req.method==='POST'&&url.pathname==='/api/command'){
    const now=Date.now(),key=id,stamp=recent.get(key)||[];
    const kept=stamp.filter(x=>now-x<5000);
    if(kept.length>=25)return reply(res,429,{error:'Command rate limit exceeded'});
    kept.push(now);recent.set(key,kept);
    const body=await readJson(req);
    const result=rules.order(galaxy,id,body);dirty=true;persist();broadcast();return reply(res,200,{...result,version:galaxy.version});
   }
   return reply(res,404,{error:'No such endpoint'});
  }catch(error){return reply(res,error.status||400,{error:error.message||'Request failed'});}
 });
 let timer=null,lastSave=Date.now();
 server.on('listening',()=>{
  clock=Date.now();
  timer=setInterval(()=>{
   const now=Date.now(),dt=Math.min(5,Math.max(0,(now-clock)/1000));clock=now;
   if(dt>0)advance(dt);
   if(dirty&&now-lastSave>=5000){try{persist();lastSave=now;}catch(e){console.error('Galaxy save error:',e.message);}}
  },tickMs);
 });
 server.on('close',()=>{if(timer)clearInterval(timer);for(const res of streams.keys()){try{res.end();}catch{}}streams.clear();if(dirty)persist();});
 return {server,advance,persist,getState:()=>galaxy,auth:authenticate};
}
if(require.main===module){
 if(process.env.NODE_ENV==='production'&&!process.env.STARFALL_INVITE_CODE)throw Error('Production requires STARFALL_INVITE_CODE to prevent unauthorized player registrations');
 const app=createServer();
 app.server.listen(Number(process.env.PORT||8788),process.env.HOST||'0.0.0.0',()=>console.log('Starfall persistent multiplayer RTS listening on port '+app.server.address().port));
}
module.exports={createServer};
