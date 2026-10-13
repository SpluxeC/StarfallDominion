/* Starfall Dominion: progressive enhancement WebGL globe.
   THREE is dynamically imported on demand; the SVG surface remains fully playable offline. */
(function(){
'use strict';
const CDN='https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
let THREE=null,renderer=null,scene=null,camera=null,globe=null,frame=0,host=null,select=null;
let planetId=null,lastSignature='',targets=[],pickers=[],rotationX=.18,rotationY=-.7,targetX=.18,targetY=-.7,radius=9.8,targetRadius=9.8,pressed=null;
let cleanup=[],active=false,loading=null,mountEpoch=0,quality='medium',lastFrameTime=0,animatedLights=[];
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
 return ({mine:0xc5a677,reactor:0x55eaf5,farm:0x67dc9a,shipyard:0x92b6ff,extractor:0xc4f2ef,foundry:0xe6a875,laboratory:0xb49cf7,tradeHub:0xffd696,outpost:0xffc76a,fortress:0x849bbd,refinery:0x8befc5})[type]||0xc6d6e6;
}
function clearGlobe(){
 if(!globe)return;
 targets=[];animatedLights=[];
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
 const accent=buildingColor(type),steel=lit(0x3c4858,{metalness:.82,roughness:.36}),dark=lit(0x182735,{metalness:.78}),armor=lit(0x70849a,{metalness:.75}),glow=lit(accent,{metalness:.38,emissive:accent,emissiveIntensity:.48}),glass=lit(0x6fc7dd,{metalness:.3,transparent:true,opacity:.72});
 animatedLights.push(glow);const H=.20+Math.min(6,level)*.065;
 const part=(geo,mat,x,y,z)=>{const m=mesh(geo,mat,group);m.position.set(x,y,z);return m;};
 const box=(w,h,d,x,y,z,mat=steel)=>part(new THREE.BoxGeometry(w,h,d),mat,x,y,z);
 const cyl=(r1,r2,h,x,y,z,mat=steel,n=10)=>part(new THREE.CylinderGeometry(r1,r2,h,n),mat,x,y,z);
 cyl(.32,.35,.055,0,.018,0,dark,12);
 cyl(.29,.30,.018,0,.052,0,armor,12);
 // Service conduits, bolted corners and hazard-strip illumination.
 for(const side of [-1,1]){
  box(.035,.035,.49,side*.245,.08,0,glow);
  box(.045,.12,.055,side*.22,.12,-.22,armor);
  box(.045,.12,.055,side*.22,.12,.22,armor);
 }
 if(type==='mine'||type==='extractor'){
  box(.32,H*.62,.30,0,.11+H*.31,0);
  for(const side of [-1,1]){
   const arm=box(.07,H*.95,.08,side*.19,.13+H*.45,0,armor);arm.rotation.z=side*.38;
   cyl(.07,.09,.10,side*.23,.11,.13,dark);
  }
  const drill=cyl(.065,.10,.28,0,.13,-.22,glow);drill.rotation.x=Math.PI/2;
  for(let j=0;j<3;j++)box(.23,.028,.035,0,.14+j*.08,.17,armor);
 }else if(type==='reactor'||type==='foundry'||type==='refinery'){
  for(const side of [-1,1]){
   cyl(.09,.12,H*.85,side*.16,.12+H*.43,0,steel);
   cyl(.095,.095,.035,side*.16,.14+H*.85,0,glow);
   const pipe=cyl(.023,.023,.32,side*.23,.14,.04,armor);pipe.rotation.z=.45;
  }
  box(.26,H*.7,.24,0,.11+H*.35,0,dark);
  for(let j=0;j<3;j++)box(.25,.025,.045,0,.15+j*.065,.14,glow);
  if(type==='foundry')cyl(.10,.13,.11,0,.12,-.20,lit(0xd97034,{emissive:0xff4a13,emissiveIntensity:.6}));
 }else if(type==='farm'||type==='laboratory'){
  for(const side of [-1,1]){
   const dome=part(new THREE.SphereGeometry(.17,16,10,0,Math.PI*2,0,Math.PI/2),glass,side*.16,.09,0);
   dome.scale.set(1,.8,1);
   for(let j=0;j<4;j++){const rib=box(.016,.12,.02,side*.16+(j-1.5)*.065,.15,0,armor);rib.rotation.z=(j-1.5)*.19;}
  }
  if(type==='laboratory'){
   cyl(.07,.10,H*.8,0,.12+H*.4,-.14,steel);
   const dish=cyl(.14,.035,.055,0,.19+H*.8,-.14,glow);dish.rotation.z=.3;
  }
 }else if(type==='outpost'){box(.31,H*.72,.29,0,.12+H*.36,0,armor);cyl(.04,.04,H*.8,0,.16+H*.78,0,steel);cyl(.09,.09,.04,0,.20+H*1.55,0,glow);for(const side of [-1,1])box(.10,.10,.10,side*.19,.13,0,dark);
 }else if(type==='shipyard'){
  box(.48,.07,.31,0,.12,0,dark);
  for(const side of [-1,1]){
   box(.065,H,.09,side*.23,.12+H*.5,0,armor);
   box(.07,.045,.39,side*.23,.16+H,0,steel);
  }
  box(.28,.045,.08,0,.19+H,-.07,glow);
  const hull=box(.23,.065,.11,0,.18,.03,glass);hull.rotation.y=.12;
 }else if(type==='fortress'){
  cyl(.17,.23,H,0,.12+H*.5,0,armor,8);
  cyl(.21,.18,.07,0,.17+H,0,dark,8);
  for(const side of [-1,1]){
   const barrel=cyl(.035,.04,.24,side*.075,.19+H,-.15,steel);barrel.rotation.x=Math.PI/2;
  }
  cyl(.07,.07,.035,0,.22+H,0,glow);
 }else{
  box(.32,H,.31,0,.12+H*.5,0,steel);
  for(let j=0;j<3;j++)box(.25,.032,.018,0,.18+j*H*.23,.164,glow);
  cyl(.12,.17,.07,0,.17+H,0,armor);
  for(const side of [-1,1])cyl(.045,.06,H*.8,side*.22,.12+H*.4,0,dark);
 }
 if(level>=2){
  for(let j=0;j<Math.min(level,5);j++){
   box(.045,.11,.045,-.20+j*.10,.19+H,0,armor);
   box(.032,.018,.03,-.20+j*.10,.25+H,0,glow);
  }
 }
 if(queued){
  const ring=mesh(new THREE.TorusGeometry(.36,.023,6,36),lit(0xffc46e,{emissive:0xff9c3b,emissiveIntensity:.8}),group);
  ring.rotation.x=Math.PI/2;ring.position.y=.08;ring.userData.construction=true;targets.push(ring);
 }
}
function buildGlobe(state){
 clearGlobe();
 const biome=palettes[state.deposit]||palettes.minerals;
 globe=new THREE.Group();scene.add(globe);
 const ground=mesh(new THREE.SphereGeometry(3,quality==='low'?32:64,quality==='low'?20:40),lit(biome.ground,{roughness:.91}));
 // Subtle deterministic surface relief, avoiding external texture downloads.
 const terrain=ground.geometry.attributes.position,vec=new THREE.Vector3();
 for(let i=0;i<terrain.count;i++){
  vec.fromBufferAttribute(terrain,i);
  const n=vec.clone().normalize();
  const waves=Math.sin(n.x*21+state.id*1.7)*Math.cos(n.z*18-n.y*7)+Math.sin(n.y*47+n.z*12)*.24;
  const relief=1+Math.max(-.003,Math.min(.006,waves*.003));
  vec.multiplyScalar(relief);
  terrain.setXYZ(i,vec.x,vec.y,vec.z);
 }
 terrain.needsUpdate=true;ground.geometry.computeVertexNormals();
 const overlays=mesh(new THREE.SphereGeometry(3.025,quality==='low'?24:48,quality==='low'?16:32),new THREE.MeshStandardMaterial({
  color:biome.alt,transparent:true,opacity:.19,wireframe:true,roughness:.8
 }));
 // Transparent blue atmospheric glow, seen around the limb.
 mesh(new THREE.SphereGeometry(3.12,quality==='low'?24:48,quality==='low'?16:32),new THREE.MeshBasicMaterial({
  color:biome.sky,transparent:true,opacity:.09,side:THREE.BackSide,depthWrite:false
 }));
 if(state.surveyed){const mineralColor=state.deposit==='crystals'?0xb58aff:state.deposit==='titanium'?0x9ab7df:state.deposit==='gas'?0x7de7c8:0xe1b079;for(let i=0;i<9;i++){const lat=.5*Math.sin(i*2.17+state.id),lon=i*2.399+state.id*.27;const cluster=surfaceGroup(lat,lon);const crystal=mesh(new THREE.ConeGeometry(.045+(i%3)*.02,.15+(i%4)*.05,5),lit(mineralColor,{emissive:mineralColor,emissiveIntensity:.16}),cluster);crystal.position.y=.09;crystal.rotation.z=(i%3-1)*.2;}}
 const positionCount=11,positions=[];
 for(let i=0;i<positionCount;i++){
  const lon=i*2*Math.PI/positionCount;
  const lat=.27*Math.sin(i*1.6);
  positions.push({lat,lon,vector:point(lat,lon)});
 }
 positions.forEach((p,i)=>route(p.vector,positions[(i+1)%positions.length].vector));
 const types=['outpost','mine','reactor','farm','shipyard','extractor','foundry','laboratory','tradeHub','fortress','refinery'];
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
 const count=Math.min(quality==='low'?50:140,Math.max(8,Math.floor(total*3+(state.level||1)*11)));
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
 if(globe)for(const ring of targets){if(ring.parent)ring.rotation.z+=.015;}if(!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){const pulse=.43+.11*Math.sin(performance.now()*.0016);for(const material of animatedLights)material.emissiveIntensity=pulse;}
 renderer.render(scene,camera);
}
async function mount(container,onSelect){
 const epoch=++mountEpoch;
 host=container;select=onSelect;
 if(active)return true;
 if(loading)return loading;
 loading=(async()=>{
  try{
   THREE=THREE||await import(CDN);
   if(epoch!==mountEpoch||!host||!host.isConnected)return false;
   scene=new THREE.Scene();
   scene.background=new THREE.Color(0x060c1d);
   scene.add(new THREE.AmbientLight(0xa9c9ea,1.35));
   const sun=new THREE.DirectionalLight(0xffe3bd,2.4);sun.position.set(-5,5,7);scene.add(sun);
   const rim=new THREE.DirectionalLight(0x61c8ff,1.8);rim.position.set(4,-2,-5);scene.add(rim);
   camera=new THREE.PerspectiveCamera(45,1,.1,100);
   renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
   quality=window.matchMedia?.('(pointer:coarse)')?.matches?'low':'medium';
   renderer.setPixelRatio(Math.min(quality==='low'?1.25:1.7,window.devicePixelRatio||1));
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
    const planetHit=ray.intersectObject(globe.children.find(obj=>obj.geometry?.type==='SphereGeometry'),false)[0];
    if(hits.length&&(!planetHit||hits[0].distance<=planetHit.distance+.25)&&select)select(hits[0].object.userData.type);
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
 mountEpoch++;
 active=false;cancelAnimationFrame(frame);cleanup.splice(0).forEach(fn=>fn());
 clearGlobe();
 if(renderer){renderer.dispose();renderer.domElement.remove();renderer=null;}
 scene=null;camera=null;host=null;planetId=null;lastSignature='';targets=[];pickers=[];pressed=null;
}
window.StarfallPlanet3D={mount,update,zoom,reset,unmount,get ready(){return active;}};
})();