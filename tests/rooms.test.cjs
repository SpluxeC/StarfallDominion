'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {server}=require('../server/rooms.cjs');
test('room create, sync, stale update rejection',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const root='http://127.0.0.1:'+server.address().port;
 const state={elapsedSeconds:0,resources:{credits:10},systems:Array.from({length:9},(_,i)=>({name:'System'+i,ships:1})),fleets:[],logs:[]};
 try{
 const create=await fetch(root+'/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state})});
 assert.equal(create.status,201);const info=await create.json();assert.match(info.room,/^[A-Z0-9]{6,12}$/);
 const current=await(await fetch(root+'/rooms/'+info.room)).json();assert.equal(current.revision,1);
 state.elapsedSeconds=10;
 const publish=await fetch(root+'/rooms/'+info.room,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:1,state})});
 assert.equal(publish.status,200);assert.equal((await publish.json()).revision,2);
 const stale=await fetch(root+'/rooms/'+info.room,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:1,state})});
 assert.equal(stale.status,409);
 const newer=await(await fetch(root+'/rooms/'+info.room)).json();assert.equal(newer.state.elapsedSeconds,10);
 }finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
