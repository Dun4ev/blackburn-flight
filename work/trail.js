import {createChapterPreview} from './chapter-preview.js';
import {createMiniMap} from './mini-map.js';

// A fictional route through the simulated landscape. All coordinates use metres, Y up.
const RAD = Math.PI / 180;
const TAU = 2 * Math.PI;
const RADIUS = 21;
const TUBE = 0.7;
const HALF_SPAN = 9.7155 / 2;
const WING_HEIGHT = 1.46;
const STORAGE = 'blackburn.flight.trail.v1';
let sessionVisits=[];
const riverX = z => 1520 + 260 * Math.sin(z / 680 + 0.4) + 130 * Math.sin(z / 270) + 50 * Math.sin(z / 151);
const specs = [
  { x:760, z:-535, height:55, title:['Главная улица','High Street'] },
  { x:riverX(-1450), z:-1450, height:68, title:['Излучина реки','River bend'] },
  { x:-385, z:-790, height:62, title:['Деревня','The village'] },
  { x:0, z:10, height:58, title:['Аэродром','The airfield'] },
];

export function makeGates(heightAt) {
  return specs.map(({x,z,height,title}, index) => {
    // The first gate aligns with the street. The second aligns with the approach after leaving it.
    const approach = index === 0 ? {x,z:z+100} : index === 1 ? {x:760,z:-1130} : specs[index-1];
    const length = Math.hypot(x-approach.x, z-approach.z);
    return { x, y:heightAt(x,z)+height, z, height, title, nx:(x-approach.x)/length, nz:(z-approach.z)/length };
  });
}

// Intersect the swept wing centre with the gate plane, then check both projected wing tips.
export function crossesGate(previous, current, gate, yaw=0, roll=0) {
  const d0 = (previous.x-gate.x)*gate.nx + (previous.z-gate.z)*gate.nz;
  const d1 = (current.x-gate.x)*gate.nx + (current.z-gate.z)*gate.nz;
  if (d0 === 0 || (d0 < 0 && d1 < 0) || (d0 > 0 && d1 > 0)) return false;
  const t = d0/(d0-d1);
  const dx = previous.x + (current.x-previous.x)*t - gate.x;
  const dz = previous.z + (current.z-previous.z)*t - gate.z;
  const horizontal = -gate.nz*dx + gate.nx*dz;
  const vertical = previous.y + (current.y-previous.y)*t + WING_HEIGHT - gate.y;
  const tipX = HALF_SPAN*Math.cos(roll)*(-gate.nz*Math.cos(yaw) + gate.nx*Math.sin(yaw));
  const tipY = -HALF_SPAN*Math.sin(roll);
  const radius = RADIUS-TUBE;
  return Math.hypot(horizontal-tipX, vertical-tipY) <= radius && Math.hypot(horizontal+tipX, vertical+tipY) <= radius;
}

function makeMarkers(T, world, gates) {
  const root = new T.Group();
  root.name = 'Flight route • fictional history markers';
  world.add(root);
  const rim = new T.TorusGeometry(RADIUS,TUBE,10,96);
  const stripe = new T.TorusGeometry(RADIUS,TUBE+0.09,10,6,0.22);
  const ivory = new T.MeshStandardMaterial({color:0xfff1ca,roughness:0.48,emissive:0x6f4d2a,emissiveIntensity:0.25});
  const materials = gates.map((gate,index) => {
    const group = new T.Group();
    group.position.set(gate.x,gate.y,gate.z);
    group.rotation.y = Math.atan2(gate.nx,gate.nz);
    root.add(group);
    const band = new T.MeshStandardMaterial({roughness:0.49,metalness:0.22,emissiveIntensity:0.48});
    group.add(new T.Mesh(rim,band));
    for(let k=0;k<8;k++) {
      const dash = new T.Mesh(stripe,ivory);
      dash.rotation.z = k*TAU/8-0.11;
      group.add(dash);
    }
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=96;
    const ctx=canvas.getContext('2d');
    ctx.beginPath();ctx.arc(48,48,43,0,TAU);ctx.fillStyle='#332b24';ctx.fill();
    ctx.lineWidth=4;ctx.strokeStyle='#f7dfaa';ctx.stroke();
    ctx.fillStyle='#fff6dd';ctx.font='bold 56px Georgia, serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(index+1),48,51);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));
    sprite.position.y=RADIUS+5.2;sprite.scale.setScalar(6.5);group.add(sprite);
    return band;
  });
  return {root,recolor(selected,visited) {
    materials.forEach((mat,i)=>{
      const color=i===selected?'#ff9a43':visited.has(i)?'#668e86':'#d8845c';
      mat.color.set(color);mat.emissive.set(i===selected?'#cf4a15':'#38291d');
    });
  }};
}

const svg = (body,cls='') => '<svg aria-hidden="true" class="'+cls+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7">'+body+'</svg>';
const closeIcon = svg('<path d="m6 6 12 12M18 6 6 18"/>');
const bookIcon = svg('<path d="M3 4h6a3 3 0 0 1 3 2 3 3 0 0 1 3-2h6v14h-6a3 3 0 0 0-3 2 3 3 0 0 0-3-2H3zM12 6v14"/>');

export function readVisited() {
  try{
    const stored=JSON.parse(localStorage.getItem(STORAGE) || '[]');
    if(Array.isArray(stored)){
      sessionVisits=[...new Set([...sessionVisits,...stored.filter(id=>Number.isInteger(id)&&id>=0&&id<specs.length)])].sort((a,b)=>a-b);
    }
  }catch{}
  return [...sessionVisits];
}

export function makeTrail(THREE, world, scenery, {lang=()=>'en',onDiscover=()=>{},onRead=()=>{}}={}) {
  const gates=makeGates(scenery.heightAt);
  const visited=new Set(readVisited());
  const markers=makeMarkers(THREE,world,gates);
  const tx=(ru,en)=>lang()==='ru'?ru:en;
  const title=point=>point.title[lang()==='ru'?0:1];
  let selected=0,visible=false,last=null,readIndex=null,messageTime=0,hudTime=0,completedOnPass=false;
  const cooldown=Array(gates.length).fill(0);
  const viewport=document.getElementById('viewport');
  const hud=document.createElement('div');hud.className='trail-hud';hud.hidden=true;
  const mapButton=document.createElement('button');mapButton.type='button';mapButton.id='trailMapButton';mapButton.hidden=true;
  const overlay=document.getElementById('overlay');
  viewport.insertBefore(mapButton,overlay);viewport.insertBefore(hud,overlay);
  const miniMap=createMiniMap(mapButton);
  const preview=createChapterPreview(hud,{onRead,onDismiss:()=>{
    readIndex=null;messageTime=0;completedOnPass=false;refreshHud();
    document.getElementById('view').focus({preventScroll:true});
  }});
  const dialog=document.createElement('dialog');dialog.id='trailMap';dialog.setAttribute('aria-labelledby','trail-title');
  dialog.innerHTML='<div class="trail-top"><div><div class="trail-heading"><h2 id="trail-title"></h2><span class="trail-progress"></span></div><p class="trail-sub"></p></div><button type="button" class="trail-close">'+closeIcon+'</button></div><canvas class="trail-chart" aria-hidden="true"></canvas><div class="trail-selectors" role="group"></div><div class="trail-details"><div><strong class="trail-detail-title"></strong><span class="trail-metrics"></span></div><button class="trail-chapter" type="button">'+bookIcon+'<span></span></button></div><button type="button" class="primary trail-resume"></button>';
  document.body.append(dialog);
  const chart=dialog.querySelector('canvas'), selector=dialog.querySelector('.trail-selectors');
  const options=gates.map((gate,i)=>{
    const button=document.createElement('button');button.type='button';button.className='trail-option';
    button.innerHTML='<b>'+String(i+1).padStart(2,'0')+'</b><span></span><i aria-hidden="true"></i>';
    button.onclick=()=>select(i);selector.append(button);return button;
  });
  const destination=()=>gates[selected];
  let plotted=[];
  const nextUnvisited=()=>gates.findIndex((_,i)=>!visited.has(i));
  function distance(meters) {
    if(meters<1000)return Math.round(meters)+' '+tx('м','m');
    return (meters/1000).toLocaleString(lang()==='ru'?'ru-RU':'en-GB',{minimumFractionDigits:1,maximumFractionDigits:1})+' '+tx('км','km');
  }
  function navigation(){
    const gate=destination();
    if(!last)return null;
    const dx=gate.x-last.x,dz=gate.z-last.z;
    const bearing=Math.atan2(dx,-dz);
    return {range:Math.hypot(dx,dz),bearing,relative:bearing-last.yaw,deltaY:gate.y-last.y-WING_HEIGHT};
  }
  function refreshHud() {
    const nav=navigation();
    miniMap.draw({gates,selected,visited,aircraft:last,lang:lang(),rangeText:nav?distance(nav.range):'',deltaY:nav?.deltaY??0});
    const showCard=readIndex!==null&&(messageTime>0||completedOnPass);
    preview(showCard?readIndex:null,lang(),completedOnPass);
  }
  function updateMap(){
    const gate=destination(),nav=navigation();
    dialog.querySelector('.trail-progress').textContent=(visited.size===gates.length
      ?tx('Маршрут пройден','Route complete'):tx('Пройдено','Visited'))+' · '+visited.size+'/4';
    options.forEach((button,i)=>{
      button.querySelector('span').textContent=title(gates[i]);button.querySelector('i').textContent=visited.has(i)?'✓':'';
      button.setAttribute('aria-pressed',String(i===selected));
      button.setAttribute('aria-label',(i+1)+'. '+title(gates[i])+(visited.has(i)?tx(', пройдено',', visited'):''));
    });
    dialog.querySelector('.trail-detail-title').textContent=tx('Точка ','Waypoint ')+(selected+1)+' · '+title(gate);
    const metrics=[gate.height+' '+tx('м над землей','m above ground')];
    if(nav){
      const deg=Math.round((nav.bearing/RAD+360)%360)%360;
      metrics.unshift(distance(nav.range)+' · '+tx('азимут ','bearing ')+String(deg).padStart(3,'0')+'°');
      metrics.push(Math.abs(nav.deltaY)<1?tx('на вашей высоте','at your altitude'):Math.abs(Math.round(nav.deltaY))+' '+(nav.deltaY>0?tx('м выше','m above you'):tx('м ниже','m below you')));
    }
    dialog.querySelector('.trail-metrics').textContent=metrics.join(' · ');
    dialog.querySelector('.trail-chapter').hidden=!visited.has(selected);
    if(dialog.open)paintChart();
  }
  function select(index){
    if(!Number.isInteger(index)||index<0||index>=gates.length)return;
    selected=index;markers.recolor(selected,visited);refreshHud();updateMap();
  }
  function refreshLanguage(){
    dialog.querySelector('h2').textContent=tx('Карта полета','Flight map');
    dialog.querySelector('.trail-sub').textContent=tx('Пролетайте через кольца, чтобы отмечать главы в журнале. Маршрут вымышлен.','Fly through the four rings to mark the chapters in your journal. The route is fictional.');
    dialog.querySelector('.trail-close').setAttribute('aria-label',tx('Закрыть карту','Close map'));
    selector.setAttribute('aria-label',tx('Выбрать точку','Select waypoint'));
    dialog.querySelector('.trail-chapter span').textContent=tx('Читать главу','Read chapter');
    dialog.querySelector('.trail-resume').textContent=tx('Вернуться в полет','Return to flight');
    refreshHud();updateMap();
  }
  function openMap(){
    if(!visible||dialog.open)return;
    dialog.showModal();updateMap();options[selected].focus({preventScroll:true});
  }
  function closeMap(){if(dialog.open)dialog.close();}
  window.addEventListener('keydown',event=>{
    if(event.code!=='KeyM'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||!visible)return;
    if(!dialog.open&&(document.querySelector('dialog[open]')||!document.getElementById('overlay')?.hidden))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(dialog.open)closeMap();else openMap();
  },true);
  mapButton.onclick=openMap;
  dialog.querySelector('.trail-close').onclick=closeMap;
  dialog.querySelector('.trail-resume').onclick=closeMap;
  dialog.querySelector('.trail-chapter').onclick=()=>{closeMap();onRead(selected);};
  dialog.addEventListener('click',event=>{if(event.target===dialog){
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeMap();
  }});
  chart.addEventListener('click',event=>{
    const box=chart.getBoundingClientRect(),x=event.clientX-box.left,y=event.clientY-box.top;
    const targets=plotted.map(([px,py],i)=>({i,d:Math.hypot(px-x,py-y)})).sort((a,b)=>a.d-b.d);
    if(targets[0]?.d<23)select(targets[0].i);
  });
  new ResizeObserver(()=>{if(dialog.open)paintChart();}).observe(chart);

  function paintChart() {
    const w=chart.clientWidth,h=chart.clientHeight;
    if(w<3||h<3)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    chart.width=Math.round(w*dpr);chart.height=Math.round(h*dpr);
    const ctx=chart.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const values=last?[...gates,last]:gates;
    const minX=Math.min(...values.map(p=>p.x))-300,maxX=Math.max(...values.map(p=>p.x))+310;
    const minZ=Math.min(...values.map(p=>p.z),-1530)-180,maxZ=Math.max(...values.map(p=>p.z),220)+130;
    const s=Math.min((w-18)/(maxX-minX),(h-24)/(maxZ-minZ));
    const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
    const X=x=>(x-cx)*s+w/2, Z=z=>(z-cz)*s+h/2;
    const xmin=cx-w/(2*s),xmax=cx+w/(2*s),zmin=cz-h/(2*s),zmax=cz+h/(2*s);
    const line=(points,color,width=1)=>{ctx.beginPath();points.forEach(([x,z],i)=>i?ctx.lineTo(X(x),Z(z)):ctx.moveTo(X(x),Z(z)));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();};
    const fill=(x,z,width,depth,color)=>{ctx.fillStyle=color;ctx.fillRect(X(x),Z(z),width*s,depth*s);};
    ctx.fillStyle='#e9e4d1';ctx.fillRect(0,0,w,h);

    // Contour the same analytical surface used by the aircraft and landing gear.
    const n=58,m=32,dx=(xmax-xmin)/n,dz=(zmax-zmin)/m,heights=[];
    for(let j=0;j<=m;j++){const row=[];for(let i=0;i<=n;i++)row.push(scenery.heightAt(xmin+i*dx,zmin+j*dz));heights.push(row);}
    ctx.lineWidth=0.7;ctx.strokeStyle='#c9c8a9';ctx.beginPath();
    for(let j=0;j<m;j++)for(let i=0;i<n;i++){
      const a=heights[j][i],b=heights[j][i+1],c=heights[j+1][i+1],d=heights[j+1][i];
      const floor=Math.ceil(Math.min(a,b,c,d)/10)*10,ceiling=Math.max(a,b,c,d);
      for(let level=floor;level<ceiling;level+=10){
        const points=[];
        const edge=(a,b,ix,iz,ex,ez)=>{if((a<level)===(b<level))return;const f=(level-a)/(b-a);points.push([X(xmin+(i+ix+ex*f)*dx),Z(zmin+(j+iz+ez*f)*dz)]);};
        edge(a,b,0,0,1,0);edge(b,c,1,0,0,1);edge(c,d,1,1,-1,0);edge(d,a,0,1,0,-1);
        for(let k=1;k<points.length;k+=2){ctx.moveTo(...points[k-1]);ctx.lineTo(...points[k]);}
      }
    }
    ctx.stroke();
    const river=[];for(let z=zmin-45;z<=zmax+45;z+=Math.max(20,(zmax-zmin)/160))river.push([riverX(z),z]);
    line(river,'#92adb0',Math.max(2.3,31*s));line(river,'#b7cecc',Math.max(1,18*s));
    const strip=scenery.runway||{xmin:-23,xmax:23,zmin:-460,zmax:220};
    fill(strip.xmin,strip.zmin,strip.xmax-strip.xmin,strip.zmax-strip.zmin,'#859069');
    fill(606,-1038,402,588,'#d8c6ae');
    for(const z of [-530,-665,-805,-945])for(const x of [694,822,941])fill(x-20,z-23,40,46,'#a28d75');
    for(const [x,z] of [[-325,-810],[-422,-745],[-367,-760],[-409,-802],[-471,-830]])fill(x,z,19,15,'#a28d75');
    const route=[[760,-535],[760,-1120],[gates[1].x,gates[1].z],[gates[2].x,gates[2].z],[gates[3].x,gates[3].z]];
    ctx.setLineDash([4,5]);line(route,'#aa7962',1.1);ctx.setLineDash([]);
    plotted=gates.map(({x,z})=>[X(x),Z(z)]);
    for(const [i,[px,py]] of plotted.entries()){
      ctx.beginPath();ctx.arc(px,py,i===selected?11.4:9.5,0,TAU);
      ctx.fillStyle=i===selected?'#803d29':visited.has(i)?'#536d64':'#f8f2dd';ctx.fill();
      ctx.lineWidth=1.2;ctx.strokeStyle=i===selected?'#482b23':'#8b6e55';ctx.stroke();
      ctx.fillStyle=i===selected||visited.has(i)?'#fff6de':'#47382d';ctx.font='600 11px Golos, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),px,py+.4);
    }
    if(last){
      ctx.save();ctx.translate(X(last.x),Z(last.z));ctx.rotate(last.yaw);
      ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(5.7,7);ctx.lineTo(0,4.1);ctx.lineTo(-5.7,7);ctx.closePath();
      ctx.fillStyle='#233e50';ctx.fill();ctx.strokeStyle='#fff7e6';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
    }
    const unit=(w/s)>3200?500:250;const length=unit*s;
    ctx.fillStyle='#444a3d';ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.font='500 10px Golos, sans-serif';
    ctx.fillText(unit+' '+tx('м','m'),13,h-12);ctx.beginPath();ctx.moveTo(13,h-10);ctx.lineTo(13,h-6);ctx.lineTo(13+length,h-6);ctx.lineTo(13+length,h-10);ctx.strokeStyle='#444a3d';ctx.lineWidth=1;ctx.stroke();
    ctx.textAlign='center';ctx.fillText(tx('С','N'),w-16,15);ctx.beginPath();ctx.moveTo(w-16,18);ctx.lineTo(w-20,31);ctx.lineTo(w-16,28);ctx.lineTo(w-12,31);ctx.closePath();ctx.fill();
  }

  function resetFlight(){
    last=null;readIndex=null;messageTime=0;hudTime=0;completedOnPass=false;cooldown.fill(0);closeMap();
    const next=nextUnvisited();select(next<0?0:next);
  }
  function setFlightVisible(value){
    visible=Boolean(value);markers.root.visible=visible;hud.hidden=!visible;mapButton.hidden=!visible;
    if(!visible)closeMap();
  }
  function update(previous,current,flight,dt){
    if(!visible||!current||!flight)return;
    last={x:current.x,y:current.y,z:current.z,yaw:flight.yaw||0};
    dt=Math.max(0,dt||0);
    if(messageTime>0){messageTime=Math.max(0,messageTime-dt);if(messageTime===0)refreshHud();}
    for(let i=0;i<gates.length;i++){
      cooldown[i]=Math.max(0,cooldown[i]-dt);
      if(cooldown[i]||!previous||flight.crashed||flight.grounded||!crossesGate(previous,current,gates[i],flight.yaw,flight.roll))continue;
      cooldown[i]=3;readIndex=i;messageTime=24;completedOnPass=false;
      if(!visited.has(i)){
        visited.add(i);sessionVisits=[...visited].sort((a,b)=>a-b);completedOnPass=visited.size===gates.length;
        try{localStorage.setItem(STORAGE,JSON.stringify(sessionVisits));}catch{}
        onDiscover(i);
      }
      const next=nextUnvisited();select(i===selected&&next>=0?next:selected);
    }
    hudTime-=dt;if(hudTime<=0){refreshHud();hudTime=.16;}
  }
  resetFlight();setFlightVisible(false);refreshLanguage();
  return {update,resetFlight,refreshLanguage,openMap,closeMap,setFlightVisible,select,
    getVisited:()=>[...visited].sort((a,b)=>a-b),isMapOpen:()=>dialog.open};
}
