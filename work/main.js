import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { lang, t, prepareLanguage, setLanguage } from './locale.js';
import { makeTrail, readVisited } from './trail.js';
import { renderHistory, chapterIndex, chapterHash } from './history-view.js';
import { Flight } from './dynamics.js';
import { makeScenery } from './scenery.js';

const byId = id => document.getElementById(id);
const canvas = byId('view'), area = byId('viewport');
const muteIcon = byId('sound').innerHTML;
const svg = body => '<svg aria-hidden="true" viewBox="0 0 24 24">'+body+'</svg>';
const soundIcon = svg('<path d="M4 9h4l5-4v14l-5-4H4zM16 8q4 4 0 8M18 5q7 7 0 14"/>');
let mode='hangar', startMode='district', phase='running', cameraMode=0, menuPaused=false;
let trail, historyOpen=false, storyIndex=0, mapWasOpen=false;
let renderer, orbit, camera, studio, world, aircraft, rotor, scenery, pmremTarget;
let modelPoints=[], supportPoints=[], fabrics=[], structures=[], bladeSources=[], bladeSamples=[], warpMeshes=[], elapsed=0, selectedFrame=false;
let throttle=.73, clockPrev=performance.now(), hudClock=0, lastWidth=0, lastHeight=0, historyGround=false;
let hintTime=0, hint='', activeDialog=null, ready=false, studioDirty=true, rudderPivot, elevatorPivot;
let stickRoll=0, stickPitch=0, stickId=null;
const flight=new Flight(), pressed=new Set();
const v3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const look=v3(), offset=v3(), tgt=v3(), local=v3(), up=v3(0,1,0);
const previousPosition=v3();
const tmpQ=new THREE.Quaternion(), tmpEuler=new THREE.Euler(0,0,0,'YXZ');
const studioDir=v3(-1.19,.60,-.83).normalize();
const camNames=['Chase','Cockpit','Fly-by'];
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function pair(a,b,first){ byId(a).setAttribute('aria-pressed',String(first)); byId(b).setAttribute('aria-pressed',String(!first)); }
const starts = {
  district: {button:'startDistrict', description:'Approach the main avenue between the towers.'},
  air: {button:'startAir', description:'Cruise 125 m above the airfield.'},
  ground: {button:'startGround', description:'Take off from the grass runway.'}
};
function chooseStart(mode){
  startMode=mode;
  for(const [id, option] of Object.entries(starts)){
    byId(option.button).setAttribute('aria-pressed',String(id===mode));
  }
  byId('startDescription').textContent=t(starts[mode].description);
}
function setSkin(frame){
  selectedFrame=frame;studioDirty=true;pair('skin','frame',!frame);
  fabrics.forEach(n=>n.visible=!frame);structures.forEach(n=>n.visible=frame);
}
byId('skin').onclick=()=>setSkin(false); byId('frame').onclick=()=>setSkin(true);
for(const [id, option] of Object.entries(starts))byId(option.button).onclick=()=>chooseStart(id);
byId('orbitReset').onclick=()=>{if(ready&&mode==='hangar')fitStudio();};
function makeStudio(){
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x2c343c);
  scene.fog=new THREE.FogExp2(0x313c46,.013);
  const hemi=new THREE.HemisphereLight(0xfff6de,0xa6acb1,1.42);scene.add(hemi);
  const key=new THREE.DirectionalLight(0xffebc7,3.2);key.position.set(-6.5,10,-7.0);
  key.castShadow=true;key.shadow.mapSize.set(2048,2048);
  Object.assign(key.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.3,far:34});key.shadow.normalBias=.012;key.shadow.bias=-.00016;key.shadow.intensity=.76;key.shadow.radius=2.2;
  scene.add(key);scene.add(key.target);
  const rim=new THREE.DirectionalLight(0xd6e5ff,1.35);rim.position.set(4,4,6);scene.add(rim);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200), new THREE.MeshStandardMaterial({color:0x333e45,roughness:.94,metalness:.08}));
  floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.005;scene.add(floor);
  const contact=document.createElement('canvas');contact.width=contact.height=96;const ctx=contact.getContext('2d');
  const gradient=ctx.createRadialGradient(48,48,0,48,48,48);
  gradient.addColorStop(0,'rgba(0,0,0,.62)');gradient.addColorStop(.45,'rgba(0,0,0,.33)');gradient.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,96,96);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(9,10),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(contact),transparent:true,depthWrite:false,opacity:.48}));
  shadow.rotation.x=-Math.PI/2;shadow.position.set(0,.003,.75);scene.add(shadow);
  return scene;
}
function supportHeight(pitch,roll){
  tmpQ.setFromEuler(tmpEuler.set(pitch,0,-roll,'YXZ'));
  let bottom=Infinity;
  for(const p of supportPoints){local.copy(p).applyQuaternion(tmpQ);bottom=Math.min(bottom,local.y);}
  return Number.isFinite(bottom)?-bottom:1.465;
}
function park(){
  aircraft.rotation.set(8.8*Math.PI/180,0,0,'YXZ');
  aircraft.position.set(0,supportHeight(aircraft.rotation.x,0),0);
  aircraft.updateMatrixWorld(true);
}
function fitStudio(){
  if(!aircraft||!orbit)return;
  park();studioDirty=true;camera.up.copy(up);camera.fov=33;camera.near=.12;camera.far=150;camera.updateProjectionMatrix();
  const right=v3().crossVectors(up,studioDir).normalize(), vert=v3().crossVectors(studioDir,right);
  const tanY=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)),tanX=tanY*camera.aspect;
  let loX=Infinity,hiX=-Infinity,loY=Infinity,hiY=-Infinity,loZ=Infinity,hiZ=-Infinity;
  for(const p of modelPoints){local.copy(p).applyMatrix4(aircraft.matrixWorld);let x=local.dot(right),y=local.dot(vert),z=local.dot(studioDir);
    loX=Math.min(loX,x);hiX=Math.max(hiX,x);loY=Math.min(loY,y);hiY=Math.max(hiY,y);loZ=Math.min(loZ,z);hiZ=Math.max(hiZ,z);}
  const cx=(loX+hiX)/2,cy=(loY+hiY)/2,cz=(loZ+hiZ)/2;
  orbit.target.copy(right).multiplyScalar(cx).addScaledVector(vert,cy).addScaledVector(studioDir,cz);
  let required=1;
  for(const p of modelPoints){
    local.copy(p).applyMatrix4(aircraft.matrixWorld).sub(orbit.target);
    const front=local.dot(studioDir);
    required=Math.max(required,front+Math.abs(local.dot(right))/(tanX*.84),front+Math.abs(local.dot(vert))/(tanY*.66));
  }
  camera.position.copy(orbit.target).addScaledVector(studioDir,required);
  orbit.minDistance=4.5;orbit.maxDistance=required*2.4;camera.lookAt(orbit.target);orbit.update();
}
function sizeView(reframe=false){
  const w=area.clientWidth,h=area.clientHeight;if(!w||!h||!renderer)return;
  if(w===lastWidth&&h===lastHeight&&!reframe)return;
  lastWidth=w;lastHeight=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  if(mode==='hangar'&&ready)fitStudio();
}
function setMode(value){mode=value;document.body.dataset.mode=value;sizeView(true);}
function resetInputs(){pressed.clear();stickRoll=stickPitch=0;stickId=null;byId('stick').firstElementChild.nextElementSibling.style.transform='translate(-50%,-50%)';}
function notifyHint(message,duration=5){hint=message;hintTime=duration;}
function keepCamera(hard,dt=1){
  const smooth=hard||reduced?1:1-Math.exp(-Math.max(dt,.0001)*4.2);
  const y=aircraft.position.y, h=aircraft.position.x, z=aircraft.position.z;
  camera.fov=cameraMode===1?70:cameraMode===2?44:53;camera.near=cameraMode===1?.045:.22;camera.far=34000;camera.updateProjectionMatrix();
  const narrow=Math.max(1,1.1/Math.max(.36,camera.aspect));
  if(cameraMode===1){
    const eye=aircraft.userData.eye;
    offset.set(eye[0],eye[1],eye[2]).applyQuaternion(aircraft.quaternion).add(aircraft.position);
    camera.position.copy(offset);camera.quaternion.copy(aircraft.quaternion);
    // The horizon stays visible just above the coaming.
    camera.rotateX(-.085);
  }else{
    const heading=-flight.yaw;
    if(cameraMode===0){
      offset.set(0,3.1*narrow,12.1*narrow).applyAxisAngle(up,heading);
      tgt.set(0,.29,-2.0).applyAxisAngle(up,heading);
    }else{
      offset.set(-10.2*narrow,3.1*narrow,-11.7*narrow).applyAxisAngle(up,heading);
      tgt.set(0,.15,1.15).applyAxisAngle(up,heading);
    }
    offset.x+=h;offset.y+=y;offset.z+=z;
    offset.y=Math.max(offset.y,scenery.heightAt(offset.x,offset.z)+1.0);
    tgt.x+=h;tgt.y+=y;tgt.z+=z;
    camera.position.lerp(offset,smooth);look.lerp(tgt,smooth);
    const visible=scenery.district.clipCamera(aircraft.position,camera.position);
    if(visible<1)camera.position.lerp(aircraft.position,1-visible);
    camera.up.copy(up);camera.lookAt(look);
  }
}
function showMovingBlades(on){
  for(const b of bladeSources)b.visible=!on;
  for(const sample of bladeSamples)sample.visible=on;
}
function fly(){
  if(!ready)return;
  try{
    if(!world){
      world=new THREE.Scene();scenery=makeScenery(THREE,world,renderer);world.environment=pmremTarget.texture;world.environmentIntensity=.43;
      trail=makeTrail(THREE,world,scenery,{lang,onRead:navigateToChapter});
    }
    trail.resetFlight();trail.setFlightVisible(true);
    setSkin(false);showMovingBlades(true);orbit.enabled=false;world.add(aircraft);
    setMode('flight');phase='running';elapsed=0;hudClock=0;cameraMode=0;byId('cameraText').textContent=t(camNames[cameraMode]);
    const spawn=startMode==='district'?scenery.district.start:undefined;
    flight.reset(startMode,scenery.heightAt,spawn);historyGround=flight.grounded;throttle=flight.throttle;setThrottle(throttle);
    resetInputs();byId('overlay').hidden=true;clockPrev=performance.now();
    placeAircraft();keepCamera(true);scenery.update(0,aircraft.position,camera.position);trail.update(null,flight,flight,0);
    const startHint={
      ground:'Full throttle · Ease the stick back as speed builds',
      district:'Follow the avenue to the first history ring',
      air:matchMedia('(pointer:coarse)').matches?'Stick on the left · Throttle at bottom right':'Arrows to fly · W / S throttle · C camera'
    };
    notifyHint(startHint[startMode],startMode==='ground'?12:6);
    hud(true);canvas.setAttribute('aria-label',t('Flight. Arrow keys control pitch and bank.'));canvas.focus({preventScroll:true});
  }catch(e){showFailure(e);}
}
function hangar(){
  if(!ready)return;
  trail?.setFlightVisible(false);
  phase='running';menuPaused=false;resetInputs();byId('overlay').hidden=true;
  if(rudderPivot)rudderPivot.rotation.y=0;if(elevatorPivot)elevatorPivot.rotation.x=0;
  warpValue=0;for(const mesh of warpMeshes)mesh.morphTargetInfluences[0]=0;
  showMovingBlades(false);studio.add(aircraft);orbit.enabled=true;orbit.enableDamping=false;setMode('hangar');park();fitStudio();setSkin(false);
  if(rotor)rotor.quaternion.copy(rotor.userData.rest);
  canvas.setAttribute('aria-label',t('3D monoplane. Drag to orbit.'));
  engine.update(0,false);byId('launch').focus({preventScroll:true});
}
function setThrottle(val){throttle=THREE.MathUtils.clamp(val,0,1);byId('throttle').value=Math.round(throttle*100);byId('gasNum').textContent=Math.round(throttle*100)+'%';}
byId('throttle').addEventListener('input',e=>setThrottle(Number(e.target.value)/100));
byId('launch').onclick=fly;byId('toHangar').onclick=hangar;byId('exitFlight').onclick=hangar;byId('restart').onclick=fly;
function placeAircraft(){
  aircraft.rotation.set(flight.pitch,-flight.yaw,-flight.roll,'YXZ');
  const groundOffset=flight.grounded?supportHeight(flight.pitch,flight.roll):1.46;
  aircraft.position.set(flight.x,flight.y+groundOffset,flight.z);
}
function renderOverlay(){
  const end=phase==='crash', edge=phase==='edge';
  byId('overlayTitle').textContent=t(end?'Flight ended':edge?'Edge of the flying area':'Paused');
  byId('overlayText').textContent=t(end?(impactReason||'Hard landing. Level the wings and reduce your descent before touchdown.'):edge?'You reached the edge of the landscape. Restart from the selected departure point.':'Your aircraft will hold its position until you resume.');
  byId('overlayGo').textContent=t(end?'Fly again':edge?'Start a new flight':'Resume');
  byId('restart').hidden=end||edge;
}
function setPhase(next){
  phase=next;resetInputs();const overlay=byId('overlay');overlay.hidden=next==='running';
  if(next==='running'){clockPrev=performance.now();canvas.focus({preventScroll:true});return;}
  renderOverlay();byId('overlayGo').focus({preventScroll:true});
  engine.update(0,false);
}
function pause(){if(mode==='flight'&&phase!=='crash'&&phase!=='edge')setPhase(phase==='running'?'paused':'running');}
byId('pause').onclick=pause;byId('overlayGo').onclick=()=>{if(phase==='crash'||phase==='edge')fly();else pause();};
function cycleCamera(){if(mode!=='flight')return;cameraMode=(cameraMode+1)%camNames.length;byId('cameraText').textContent=t(camNames[cameraMode]);keepCamera(true);}
byId('cameraBtn').onclick=cycleCamera;
function dialog(id){
  activeDialog=byId(id);menuPaused=mode==='flight'&&phase==='running';resetInputs();if(menuPaused)engine.update(0,false);activeDialog.showModal();
}
byId('help').onclick=()=>dialog('helpDialog');
for(const el of document.querySelectorAll('dialog')){
  el.querySelector('.dialog-close').onclick=()=>el.close();
  el.addEventListener('click',event=>{if(event.target===el){const r=el.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)el.close();}});
  el.addEventListener('close',()=>{activeDialog=null;menuPaused=false;clockPrev=performance.now();});
}
byId('fullscreen').onclick=async()=>{
  try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{}
};
if(!document.fullscreenEnabled)byId('fullscreen').hidden=true;
function fullScreenLabel(){
  const label=t(document.fullscreenElement?'Exit full screen':'Full screen');
  byId('fullscreen').title=label;byId('fullscreen').setAttribute('aria-label',label);
}
document.addEventListener('fullscreenchange',fullScreenLabel);
let audioCtx, soundOn=false, sourceGain, filter, oscillator;
const engine={
  async toggle(){
    try{
      if(!audioCtx){
        audioCtx=new (window.AudioContext||window.webkitAudioContext)();const ctx=audioCtx;
        const harmonicCount=36, real=new Float32Array(harmonicCount), imag=new Float32Array(harmonicCount);
        for(let i=1;i<harmonicCount;i++){imag[i]=(i%2?.91:.52)*Math.exp(-i/13)/Math.pow(i,.52);}
        oscillator=ctx.createOscillator();oscillator.setPeriodicWave(ctx.createPeriodicWave(real,imag));oscillator.frequency.value=42;
        const sub=ctx.createOscillator(), subGain=ctx.createGain();sub.type='sine';sub.frequency.value=12.4;subGain.gain.value=.045;
        filter=ctx.createBiquadFilter();filter.type='lowpass';filter.Q.value=.4;
        sourceGain=ctx.createGain();sourceGain.gain.value=0;const compressor=ctx.createDynamicsCompressor();
        oscillator.connect(filter).connect(sourceGain).connect(compressor).connect(ctx.destination);
        sub.connect(subGain).connect(oscillator.frequency);sub.start();oscillator.start();
      }
      await audioCtx.resume();soundOn=!soundOn;
      const el=byId('sound');el.innerHTML=soundOn?soundIcon:muteIcon;el.setAttribute('aria-pressed',String(soundOn));el.title=t(soundOn?'Mute sound':'Enable sound');el.setAttribute('aria-label',el.title);
      this.update(throttle,mode==='flight'&&phase==='running');
    }catch{byId('sound').title=t('Audio is unavailable in this browser');}
  },
  update(t,running){
    if(!audioCtx)return;const now=audioCtx.currentTime;
    sourceGain.gain.setTargetAtTime(soundOn&&running?.09+t*.045:0,now,.12);
    oscillator.frequency.setTargetAtTime(26+t*45,now,.11);filter.frequency.setTargetAtTime(260+t*900,now,.16);
  }
};
byId('sound').onclick=()=>engine.toggle();
const keyCodes=new Set(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','KeyW','KeyS','KeyQ','KeyE','KeyC','KeyP']);
window.addEventListener('keydown',e=>{
  if(mode!=='flight'||activeDialog||historyOpen||trail?.isMapOpen()||!keyCodes.has(e.code)||e.metaKey||e.ctrlKey||e.altKey)return;
  e.preventDefault();
  if(e.code==='KeyP'){if(!e.repeat)pause();return;}
  if(e.code==='KeyC'){if(!e.repeat&&phase==='running')cycleCamera();return;}
  if(phase==='running')pressed.add(e.code);
});
window.addEventListener('keyup',e=>pressed.delete(e.code));
window.addEventListener('blur',resetInputs); document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='flight'&&phase==='running'&&!activeDialog&&!historyOpen&&!trail?.isMapOpen())setPhase('paused');});
const stick=byId('stick');
function posStick(e){
  const r=stick.getBoundingClientRect();let x=(e.clientX-r.left-r.width/2)/(r.width*.40),y=(e.clientY-r.top-r.height/2)/(r.height*.40);
  const m=Math.max(1,Math.hypot(x,y));stickRoll=x/m;stickPitch=y/m;
  stick.querySelector('b').style.transform='translate(calc(-50% + '+stickRoll*r.width*.31+'px),calc(-50% + '+stickPitch*r.height*.31+'px))';
}
stick.onpointerdown=e=>{if(stickId!==null)return;stickId=e.pointerId;stick.setPointerCapture(e.pointerId);posStick(e);};
stick.onpointermove=e=>{if(stickId===e.pointerId)posStick(e);};stick.onlostpointercapture=()=>resetInputs();
function hud(force=false){
  if(hudClock<.09&&!force)return;hudClock=0;
  const alt=Math.max(0,flight.y-scenery.heightAt(flight.x,flight.z));
  byId('alt').textContent=Math.round(alt);byId('speed').textContent=Math.round(flight.speed*3.6);
  byId('heading').textContent=String((Math.round(flight.yaw*180/Math.PI)%360+360)%360).padStart(3,'0');
  byId('clock').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(Math.floor(elapsed%60)).padStart(2,'0');
  byId('stateText').textContent=t(flight.crashed?'Flight ended':flight.grounded?(flight.speed<.6?'On the ground':'On the runway'):flight.stall?'Stall':'Airborne');
  const dist=Math.hypot(flight.x,flight.z);
  byId('advice').textContent=flight.stall?t('Stall · Lower the nose and increase throttle'):hintTime>0?t(hint):dist>3650?t('Airfield · Bearing')+' '+String(Math.round((Math.atan2(-flight.x,flight.z)*180/Math.PI+360)%360)).padStart(3,'0')+'°':'';
}
let impactReason='', warpValue=0, lastShutterSpeed=-1;
const shutterMatrix=new THREE.Matrix4();
function step(dt){
  const held=k=>pressed.has(k)?1:0;
  const input={pitch:THREE.MathUtils.clamp(held('ArrowDown')-held('ArrowUp')+stickPitch,-1,1),roll:THREE.MathUtils.clamp(held('ArrowRight')-held('ArrowLeft')+stickRoll,-1,1),yaw:held('KeyE')-held('KeyQ')};
  const power=held('KeyW')-held('KeyS');if(power)setThrottle(throttle+power*.32*dt);input.throttle=throttle;
  previousPosition.set(flight.x,flight.y,flight.z);
  elapsed+=dt;hintTime-=dt;hudClock+=dt;flight.step(dt,input,scenery.heightAt);
  impactReason='';
  if(!flight.crashed && scenery.collisionAt(flight.x,flight.y,flight.z,previousPosition,flight)){
    flight.crashed=true;
    impactReason='The aircraft struck an obstacle. You can retry from the same starting point.';
  }
  if(!flight.crashed&&Math.hypot(flight.x,flight.z)>7600){setPhase('edge');return;}
  if(flight.grounded&&!historyGround&&!flight.crashed)notifyHint('Touchdown · Reduce throttle to stop',7);historyGround=flight.grounded;
  placeAircraft();
  if(rotor){
    const angularSpeed=24+throttle*95;rotor.rotateZ(angularSpeed*dt);
    if(Math.abs(angularSpeed-lastShutterSpeed)>.30){
      for(const sample of bladeSamples){
        for(let k=0;k<sample.count;k++)sample.setMatrixAt(k,shutterMatrix.makeRotationZ(-angularSpeed*.017*(k+.5)/sample.count));
        sample.instanceMatrix.needsUpdate=true;
      }
      lastShutterSpeed=angularSpeed;
    }
  }
  warpValue+=(input.roll-warpValue)*(1-Math.exp(-5*dt));
  for(const mesh of warpMeshes)mesh.morphTargetInfluences[0]=warpValue;
  if(rudderPivot)rudderPivot.rotation.y=input.yaw*.28;if(elevatorPivot)elevatorPivot.rotation.x=-input.pitch*.24;
  trail.update(previousPosition,flight,flight,dt);
  keepCamera(false,dt);scenery.update(dt,aircraft.position,camera.position);hud();engine.update(throttle,!flight.crashed);
  if(flight.crashed){hud(true);setPhase('crash');}
}
function showFailure(error){
  console.error(error);byId('loading').hidden=false;
  byId('loading').textContent=t('The 3D scene needs WebGL 2. Enable hardware acceleration in your browser and reopen the file.');
  byId('launch').disabled=true;ready=false;
}
async function init(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  studio=makeStudio();camera=new THREE.PerspectiveCamera(33,1,.12,150);
  const environment=new RoomEnvironment(), generator=new THREE.PMREMGenerator(renderer);
  pmremTarget=generator.fromScene(environment,.035);environment.dispose();generator.dispose();
  studio.environment=pmremTarget.texture;studio.environmentIntensity=.58;
  orbit=new OrbitControls(camera,canvas);orbit.addEventListener('change',()=>{studioDirty=true;});orbit.enableDamping=false;orbit.enablePan=false;
  orbit.minPolarAngle=.13;orbit.maxPolarAngle=Math.PI*.485;orbit.zoomSpeed=.64;orbit.rotateSpeed=.78;
  const data=byId('aircraftData');const src=atob(data.textContent.trim()),bytes=new Uint8Array(src.length);
  for(let i=0;i<src.length;i++)bytes[i]=src.charCodeAt(i);
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');aircraft=new THREE.Group();aircraft.name='Blackburn Type D';aircraft.add(gltf.scene);
  aircraft.userData.eye=[0,.68,.55];
  aircraft.updateMatrixWorld(true);
  gltf.scene.traverse(n=>{
    if(n.name.startsWith('Fabric_'))fabrics.push(n);if(n.name.startsWith('Structure_'))structures.push(n);
    if(n.name==='Propeller')rotor=n;
    if(n.name==='Rudder')rudderPivot=n;if(n.name==='Elevator')elevatorPivot=n;
    if(!n.isMesh)return;n.castShadow=true;n.receiveShadow=true;
    const attr=n.geometry.getAttribute('position');if(!attr)return;
    const stride=Math.max(1,Math.floor(attr.count/1200));for(let i=0;i<attr.count;i+=stride){
      const p=v3().fromBufferAttribute(attr,i).applyMatrix4(n.matrixWorld);modelPoints.push(p);
      if(p.y<-.80)supportPoints.push(p);
    }
  });
  // Warp about the forward spar. The anchored rigging endpoints share the movement of the covering.
  for(const groupName of ['Fabric_Wings','Fabric_WingTapes','Structure_WingSpars','Structure_WingRibs','Rigging_Wires','Rigging_Turnbuckles']){
    const group=gltf.scene.getObjectByName(groupName);
    group?.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const geo=mesh.geometry, p=geo.getAttribute('position'), delta=new Float32Array(p.count*3);
      for(let i=0;i<p.count;i++){
        const x=p.getX(i), span=THREE.MathUtils.clamp((Math.abs(x)-.56)/4.30,0,1);
        const aft=THREE.MathUtils.clamp((p.getZ(i)+.67)/1.81,0,1);
        delta[3*i+1]=Math.sign(x)*.17*Math.pow(span,1.48)*aft;
      }
      geo.morphTargetsRelative=true;geo.morphAttributes.position=[new THREE.BufferAttribute(delta,3)];
      mesh.updateMorphTargets();warpMeshes.push(mesh);
    });
  }
  if(rotor){
    rotor.userData.rest=rotor.quaternion.clone();
    // Accumulate shutter samples of the actual carved blade. Metal hub and rotary engine stay opaque.
    rotor.traverse(n=>{if(n.isMesh&&/laminated propeller|darker laminations/.test(n.material?.name))bladeSources.push(n);});
    for(const blade of bladeSources){
      const mat=blade.material.clone();mat.transparent=true;mat.opacity=.034;mat.depthWrite=false;
      const ghost=new THREE.InstancedMesh(blade.geometry,mat,18);ghost.visible=false;ghost.frustumCulled=false;
      rotor.add(ghost);bladeSamples.push(ghost);
    }
  }
  setSkin(false);
  if(!modelPoints.length)throw new Error('Empty aircraft model');
  studio.add(aircraft);ready=true;park();sizeView(true);fitStudio();
  byId('loading').hidden=true;byId('launch').disabled=false;new ResizeObserver(()=>sizeView()).observe(area);
  if(historyOpen)drawHistory();
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(mode==='flight'&&phase==='running')setPhase('paused');showFailure(new Error('WebGL context lost'));});
  renderer.setAnimationLoop(now=>{
    if(!ready)return;const dt=Math.min(.12,Math.max(0,(now-clockPrev)/1000));clockPrev=now;
    if(historyOpen)return;
    const mapOpen=trail?.isMapOpen()??false;
    if(mapOpen&&!mapWasOpen){resetInputs();engine.update(0,false);}
    mapWasOpen=mapOpen;
    if(mode==='flight'&&phase==='running'&&!menuPaused&&!mapOpen){step(dt);}
    if(mode==='hangar'&&!studioDirty)return;
    renderer.render(mode==='hangar'?studio:world,camera);studioDirty=false;
  });
}
function drawHistory(){
  renderHistory({
    index:storyIndex, visited:trail?.getVisited()??readVisited(), canFly:ready,
    onChapter:navigateToChapter, onModel:()=>dialog('aboutDialog'),
    onFly:index=>{
      history.replaceState(null,'','#flight');syncSection();
      if(mode!=='flight'||phase==='crash'||phase==='edge')fly();
      else if(phase==='paused')setPhase('running');
      trail?.select(index);canvas.focus({preventScroll:true});
    }
  });
}
function navigateToChapter(index){
  const hash=chapterHash(index);
  if(location.hash===hash)syncSection();
  else location.hash=hash;
}
function syncSection(){
  const wasOpen=historyOpen;
  historyOpen=location.hash==='#history'||location.hash.startsWith('#history/');
  document.body.dataset.section=historyOpen?'history':'sim';
  byId('simMain').hidden=historyOpen;byId('historyView').hidden=!historyOpen;
  for(const [id,active] of [['historyTab',historyOpen],['simTab',!historyOpen]]){
    if(active)byId(id).setAttribute('aria-current','page');else byId(id).removeAttribute('aria-current');
  }
  trail?.setFlightVisible(!historyOpen&&mode==='flight');
  resetInputs();clockPrev=performance.now();
  if(historyOpen){
    if(location.hash.includes('/'))storyIndex=chapterIndex(location.hash);
    engine.update(0,false);drawHistory();byId('historyView').scrollTop=0;
  }else if(wasOpen){
    sizeView(true);studioDirty=true;
    if(mode==='flight')canvas.focus({preventScroll:true});
  }
}
function refreshLanguage(code){
  setLanguage(code);chooseStart(startMode);fullScreenLabel();
  const sound=byId('sound');sound.title=t(soundOn?'Mute sound':'Enable sound');sound.setAttribute('aria-label',sound.title);
  byId('cameraText').textContent=t(camNames[cameraMode]);trail?.refreshLanguage();
  canvas.setAttribute('aria-label',t(mode==='flight'?'Flight. Arrow keys control pitch and bank.':'3D monoplane. Drag to orbit.'));
  if(mode==='flight'){hud(true);if(phase!=='running')renderOverlay();}
  if(historyOpen)drawHistory();
}
byId('langEn').onclick=()=>refreshLanguage('en');byId('langRu').onclick=()=>refreshLanguage('ru');
window.addEventListener('hashchange',syncSection);
prepareLanguage();refreshLanguage(lang());syncSection();
init().catch(showFailure);
