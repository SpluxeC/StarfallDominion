/* Starfall Dominion: progressive enhancement WebGL globe.
   THREE is dynamically imported on demand; the SVG surface remains fully playable offline. */
(function(){
'use strict';
const CDN='https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
let THREE=null,renderer=null,scene=null,camera=null,globe=null,frame=0,host=null,select=null;
let planetId=null,lastSignature='',targets=[],pickers=[],rotationX=.18,rotationY=-.7,targetX=.18,targetY=-.7,radius=9.8,targetRadius=9.8,pressed=null;
let cleanup=[],active=false,loading=null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const palettes={
 gas:{ground:0x485c91,alt:0x647aa6,sky:0x90b7f7,emissive:0x8c6ed6},
 titanium:{ground:0x775264,alt:0x957884,sky:0xf0aaa5,emissive:0xea8f84},
 crystals:{ground:0x156a80,alt:0x218da0,sky:0x81e7f9,emissive:0x6eefff},
 minerals:{ground:0x9a6245,alt:0xbd8061,sky:0xf6c395,emissive:0xffb87b}
};
function addListener(el,event,callback,options){
 el.addEventListener(event,callback,options);cleanup.push(()=>el.removeEventListener(event,callback,options));
}
function buildingColor(type){
 return ({mine:0xc5a677,reactor:0x55eaf5,farm:0x67dc9a,shipyard:0x92b6ff,extractor:0xc4f2ef,foundry:0xe6a875,laboratory:0xb49cf7,tradeHub:0xffd696,fortress:0x849bbd,refinery:0x8befc5})[type]||0xc6d6e6;
}
function clearGlobe(){
 if(!globe)return;
 globe.traverse(obj=>{
  if(obj.geometry)obj.geometry.dispose();
  if(obj.material){for(const mat of (Array.isArray(obj.material)?obj.material:[obj.material]))mat.dispose();}
 });
 scene.remove(globe);globe=null;pickers=[];
}
function mesh(geo,material,parent=globe){
 const m=new THREE.Mesh(geo,material);parent.add(m);return m;
}
function lit(color,opts={}){
 return new THREE.MeshStandardMaterial({color,roughness:.62,metalness:.28,...opts});
}
function point(lat,lon,height=3.05){
 return new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)).multiplyScalar(height);
}
function surfaceGroup(lat,lon){
 const group=new THREE.Group();
 const normal=point(lat,lon,1).normalize();
 group.position.copy(normal.clone().multiplyScalar(3.04));
 group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
 globe.add(group);return group;
}
function route(from,to,r=3.065){
 const pts=[];
 for(let j=0;j<=32;j++){
  const v=from.clone().normalize().lerp(to.clone().normalize(),j/32).normalize().multiplyScalar(r);pts.push(v);
 }
 const geom=new THREE.BufferGeometry().setFromPoints(pts);
 const line=new THREE.Line(geom,new THREE.LineBasicMaterial({color:0x70d5eb,transparent:true,opacity:.58}));
 globe.add(line);
}
function buildDistrict(group,type,level,queued){
 const color=buildingColor(type),base=lit(0x213b58),trim=lit(color,{emissive:color,emissiveIntensity:.21});
 const H=.12+Math.min(8,level)*.09,W=.29;
 const pad=mesh(new THREE.CylinderGeometry(.3,.33,.055,8),lit(0x567c98),group);
 pad.position.y=.015;
 const geom=(type==='farm'||type==='reactor')?new THREE.CylinderGeometry(.18,.23,H,9):
             (type==='fortress')?new THREE.CylinderGeometry(.22,.29,H,6):
             new THREE.BoxGeometry(W,H,W);
 const tower=mesh(geom,base,group);tower.position.y=H/2+.06;
 const roof=mesh(type==='reactor'?new THREE.SphereGeometry(.15,12,8):
                 type==='laboratory'?new THREE.SphereGeometry(.13,12,8):
                 type==='farm'?new THREE.SphereGeometry(.21,16,9):
                 new THREE.CylinderGeometry(.12,.17,.075,8),trim,group);
 roof.position.y=H+.11;
 if(type==='shipyard'||type==='fortress'){
  for(let j=-1;j<=1;j+=2){const wing=mesh(new THREE.BoxGeometry(.12,H*.7,.13),trim,group);wing.position.set(j*.2,H*.39,.0);}
 }
 if(level>=2){
  for(let j=0;j<Math.min(level,5);j++){
   const fin=mesh(new THREE.BoxGeometry(.07,.10,.06),trim,group);
   fin.position.set((j%2?1:-1)*.16,.1+j*.10,.18);
  }
 }
 if(type==='farm'){
  const dome=mesh(new THREE.SphereGeometry(.19,12,8,0,Math.PI*2,0,Math.PI/2),lit(0x54db9d,{transparent:true,opacity:.53}),group);
  dome.position.y=.10;
 }
 if(queued){
  const ring=mesh(new THREE.TorusGeometry(.35,.02,5,32),lit(0xffcc77,{emissive:0xffaa55,emissiveIntensity:.6}),group);
  ring.rotation.x=Math.PI/2;ring.position.y=.05;ring.userData.construction=true;targets.push(ring);
 }
}
function buildGlobe(state){
 clearGlobe();
 const biome=palettes[state.deposit]||palettes.minerals;
 globe=new THREE.Group();scene.add(globe);
 const ground=mesh(new THREE.SphereGeometry(3,72,48),lit(biome.ground,{roughness:.86}));
 const overlays=mesh(new THREE.SphereGeometry(3.009,48,32),new THREE.MeshStandardMaterial({
  color:biome.alt,transparent:true,opacity:.19,wireframe:true,roughness:.8
 }));
 // Transparent blue atmospheric glow, seen around the limb.
 mesh(new THREE.SphereGeometry(3.12,48,32),new THREE.MeshBasicMaterial({
  color:biome.sky,transparent:true,opacity:.09,side:THREE.BackSide,depthWrite:false
 }));
 const positionCount=10,positions=[];
 for(let i=0;i<positionCount;i++){
  const lon=i*2*Math.PI/positionCount;
  const lat=.27*Math.sin(i*1.6);
  positions.push({lat,lon,vector:point(lat,lon)});
 }
 positions.forEach((p,i)=>route(p.vector,positions[(i+1)%positions.length].vector));
 const types=['mine','reactor','farm','shipyard','extractor','foundry','laboratory','tradeHub','fortress','refinery'];
 const queued=new Set(state.jobs||[]);
 types.forEach((type,i)=>{
  const pos=positions[i],group=surfaceGroup(pos.lat,pos.lon),level=Number(state.buildings?.[type]||0);
  if(level)buildDistrict(group,type,level,queued.has(type));
  else{
   const pad=mesh(new THREE.CylinderGeometry(.3,.32,.028,8),lit(0x3c7698,{transparent:true,opacity:.75}),group);
   pad.position.y=.01;
   const marker=mesh(new THREE.TorusGeometry(.17,.018,6,24),lit(0xa0eefa),group);
   marker.rotation.x=Math.PI/2;marker.position.y=.03;
   if(queued.has(type))buildDistrict(group,type,1,true);
  }
  const hit=mesh(new THREE.SphereGeometry(.39,10,8),new THREE.MeshBasicMaterial({visible:false}),group);
  hit.position.y=.22;hit.userData.type=type;pickers.push(hit);
 });
 // City population visual density grows with both colony level and real structures.
 const total=Object.values(state.buildings||{}).reduce((n,x)=>n+(Number(x)||0),0);
 const count=Math.min(140,Math.max(8,Math.floor(total*3+(state.level||1)*11)));
 for(let i=0;i<count;i++){
  const lat=Math.asin(-1+2*(i+.5)/count),lon=i*2.399963229728653+state.id*.42;
  const g=surfaceGroup(lat,lon),h=.04+(i*17%13)/210+Math.min(4,state.level||1)*.012;
  const tiny=mesh(new THREE.BoxGeometry(.045,h,.055),lit(i%5===0?biome.emissive:0x4d7691,{
   emissive:i%5===0?biome.emissive:0x000000,emissiveIntensity:.25
  }),g);tiny.position.y=h/2;
 }
 globe.rotation.set(rotationX,rotationY,0);
}
function signature(state){
 return JSON.stringify([state.id,state.deposit,state.level,state.buildings,state.jobs]);
}
function resize(){
 if(!renderer||!host)return;
 const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
 renderer.setSize(width,height,false);
 camera.aspect=width/height;camera.updateProjectionMatrix();
}
function animate(){
 if(!active)return;
 frame=requestAnimationFrame(animate);
 targetX=clamp(targetX,-1.35,1.35);
 rotationX+=(targetX-rotationX)*.10;
 rotationY+=(targetY-rotationY)*.10;
 radius+=(targetRadius-radius)*.11;
 if(globe)globe.rotation.set(rotationX,rotationY,0);
 camera.position.set(0,1.1,radius);camera.lookAt(0,0,0);
 if(globe)for(const ring of targets){if(ring.parent)ring.rotation.z+=.015;}
 renderer.render(scene,camera);
}
async function mount(container,onSelect){
 host=container;select=onSelect;
 if(active)return true;
 if(loading)return loading;
 loading=(async()=>{
  try{
   THREE=THREE||await import(CDN);
   if(!host||!host.isConnected)return false;
   scene=new THREE.Scene();
   scene.background=new THREE.Color(0x060c1d);
   scene.add(new THREE.AmbientLight(0xa9c9ea,1.35));
   const sun=new THREE.DirectionalLight(0xffe3bd,2.4);sun.position.set(-5,5,7);scene.add(sun);
   const rim=new THREE.DirectionalLight(0x61c8ff,1.8);rim.position.set(4,-2,-5);scene.add(rim);
   camera=new THREE.PerspectiveCamera(45,1,.1,100);
   renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
   renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
   renderer.outputColorSpace=THREE.SRGBColorSpace;
   container.replaceChildren(renderer.domElement);
   renderer.domElement.setAttribute('aria-label','Rotatable 3D planet. Drag to rotate, scroll or buttons to zoom, click a building to inspect.');
   renderer.domElement.tabIndex=0;
   const canvas=renderer.domElement;
   addListener(canvas,'pointerdown',e=>{pressed={x:e.clientX,y:e.clientY,dragged:false};try{canvas.setPointerCapture(e.pointerId);}catch{}});
   addListener(canvas,'pointermove',e=>{
    if(!pressed)return;
    const dx=e.clientX-pressed.x,dy=e.clientY-pressed.y;
    if(Math.abs(dx)+Math.abs(dy)>2)pressed.dragged=true;
    targetY+=dx*.007;targetX+=dy*.007;pressed.x=e.clientX;pressed.y=e.clientY;
   });
   addListener(canvas,'pointerup',e=>{
    if(!pressed)return;
    const didDrag=pressed.dragged;pressed=null;
    if(didDrag||!globe)return;
    const rect=canvas.getBoundingClientRect(),xy=new THREE.Vector2(
     (e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    const ray=new THREE.Raycaster();ray.setFromCamera(xy,camera);
    const hits=ray.intersectObjects(pickers,false);
    if(hits.length&&select)select(hits[0].object.userData.type);
   });
   addListener(canvas,'pointercancel',()=>{pressed=null;});
   addListener(canvas,'wheel',e=>{e.preventDefault();zoom(e.deltaY>0?-.35:.35);},{passive:false});
   addListener(canvas,'keydown',e=>{
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){targetY+=(e.key==='ArrowLeft'?.18:-.18);e.preventDefault();}
    if(e.key==='ArrowUp'||e.key==='ArrowDown'){targetX+=(e.key==='ArrowUp'?.18:-.18);e.preventDefault();}
    if(e.key==='+'||e.key==='='){zoom(.4);e.preventDefault();}
    if(e.key==='-'){zoom(-.4);e.preventDefault();}
   });
   addListener(window,'resize',resize);
   resize();active=true;animate();return true;
  }catch(err){
   console.warn('3D planet unavailable, maintaining 2D construction surface',err);
   unmount();return false;
  }finally{loading=null;}
 })();
 return loading;
}
function update(state){
 if(!active||!state)return;
 const next=signature(state);
 if(planetId!==state.id||next!==lastSignature){
  planetId=state.id;lastSignature=next;targets=[];buildGlobe(state);
 }
}
function zoom(delta){targetRadius=clamp(targetRadius-delta,5.2,15.5);}
function reset(){targetX=.18;targetY=-.7;targetRadius=9.8;}
function unmount(){
 active=false;cancelAnimationFrame(frame);cleanup.splice(0).forEach(fn=>fn());
 clearGlobe();
 if(renderer){renderer.dispose();renderer.domElement.remove();renderer=null;}
 scene=null;camera=null;host=null;planetId=null;lastSignature='';targets=[];pickers=[];pressed=null;
}
window.StarfallPlanet3D={mount,update,zoom,reset,unmount,get ready(){return active;}};
})();