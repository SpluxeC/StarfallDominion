'use strict';
// Experimental turn-sharing backend. No dependencies. Not production authentication or multiplayer.
const http=require('node:http');
const crypto=require('node:crypto');
const PORT=Number(process.env.PORT||8787);
const origins=(process.env.ALLOWED_ORIGINS||'https://spluxec.github.io,http://localhost:3000,http://127.0.0.1:3000').split(',').map(s=>s.trim());
const rooms=new Map();
function response(res,status,obj){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
function isValidState(s){return s&&typeof s==='object'&&Number.isInteger(s.turn)&&s.turn>0&&s.resources&&Array.isArray(s.systems)&&s.systems.length===9&&Array.isArray(s.fleets)&&Array.isArray(s.logs)&&s.logs.length<=1000&&s.systems.every(x=>x&&typeof x.name==='string'&&Number.isInteger(x.ships)&&x.ships>=0);}
function parseBody(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>300000){reject(Error('Payload too large'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(raw));}catch{reject(Error('Invalid JSON'));}});req.on('error',reject);});}
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(origin&&origins.includes(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');}
 if(req.method==='OPTIONS')return res.writeHead(origin&&origins.includes(origin)?204:403).end();
 if(origin&&!origins.includes(origin))return response(res,403,{error:'Origin not allowed'});
 if(req.method==='GET'&&req.url==='/health')return response(res,200,{ok:true,rooms:rooms.size});
 if(req.method==='POST'&&req.url==='/rooms'){try{const body=await parseBody(req);if(!isValidState(body.state))return response(res,400,{error:'Invalid state'});let room;do{room=crypto.randomBytes(5).toString('hex').toUpperCase();}while(rooms.has(room));rooms.set(room,{state:body.state,revision:1,updated:Date.now()});return response(res,201,{room,revision:1});}catch(e){return response(res,400,{error:e.message});}}
 const match=req.url.match(/^\/rooms\/([A-Z0-9]{6,12})$/);
 if(!match)return response(res,404,{error:'Not found'});
 const room=rooms.get(match[1]);if(!room)return response(res,404,{error:'Room not found'});
 if(req.method==='GET')return response(res,200,{state:room.state,revision:room.revision});
 if(req.method==='PUT'){try{const body=await parseBody(req);if(!Number.isInteger(body.revision)||body.revision!==room.revision)return response(res,409,{error:'Revision conflict. Load latest room first.'});if(!isValidState(body.state))return response(res,400,{error:'Invalid state'});room.state=body.state;room.revision++;room.updated=Date.now();return response(res,200,{revision:room.revision});}catch(e){return response(res,400,{error:e.message});}}
 return response(res,405,{error:'Method not allowed'});
});
if(require.main===module)server.listen(PORT,()=>console.log('Starfall room server listening on '+PORT));
module.exports={server,isValidState};
