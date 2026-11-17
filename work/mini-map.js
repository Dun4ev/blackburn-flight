// A track-up chart in the same X/east, Z/south metre grid as the landscape.
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function miniView(aircraft, width, height, targetRange=0, targetAngle=0) {
  const yaw = aircraft.yaw || 0;
  const side=Math.sin(targetAngle),front=Math.cos(targetAngle);
  const shift=clamp(targetRange/1000,0,1);
  const cx=width*(.5-.15*side*shift),cy=height*(.5+.17*front*shift);
  const availableX=side<0?cx-13:width-cx-13;
  const availableY=front>=0?cy-13:height-cy-13;
  const fit=.94*Math.min(availableX/Math.max(1e-8,Math.abs(side)),availableY/Math.max(1e-8,Math.abs(front)));
  return {
    x:aircraft.x, z:aircraft.z, yaw,
    cos:Math.cos(yaw), sin:Math.sin(yaw), width, height,
    cx,cy,scale:clamp(fit/Math.max(1,targetRange),width/6800,width/1450),
  };
}

// Bearings and edge arrows use the unclipped direction, including when the gate is behind.
export function projectMiniPoint(view, point, inset=12) {
  const dx=point.x-view.x, dz=point.z-view.z;
  const rx=(dx*view.cos+dz*view.sin)*view.scale;
  const ry=(-dx*view.sin+dz*view.cos)*view.scale;
  const fractionX=rx<0?(inset-view.cx)/rx:rx>0?(view.width-inset-view.cx)/rx:Infinity;
  const fractionY=ry<0?(inset-view.cy)/ry:ry>0?(view.height-inset-view.cy)/ry:Infinity;
  const fraction=clamp(Math.min(fractionX,fractionY),0,1);
  return {x:view.cx+rx*fraction,y:view.cy+ry*fraction,angle:Math.atan2(rx,-ry),
    clipped:fraction<1,range:Math.hypot(dx,dz)};
}

export function miniCourse(angle) {
  const bearing=Math.atan2(Math.sin(angle),Math.cos(angle));
  if(Math.abs(bearing)<12*DEG)return 'ahead';
  if(Math.abs(bearing)>153*DEG)return 'behind';
  return bearing>0?'right':'left';
}

const language={
  en:{open:'Open flight map', target:'Ring',ahead:'Ahead',behind:'Behind',right:'Right',left:'Left',climb:'Climb',descend:'Descend',level:'On altitude',m:'m',north:'N'},
  ru:{open:'Открыть карту полета',target:'Кольцо',ahead:'Прямо',behind:'Сзади',right:'Вправо',left:'Влево',climb:'Набрать',descend:'Снизиться',level:'На высоте кольца',m:'м',north:'С'},
};

function pathFrom(points){
  const path=new Path2D();
  for(const [i,[x,z]] of points.entries()) i?path.lineTo(x,z):path.moveTo(x,z);
  return path;
}

function landmarks(){
  const northSouth=[],valley=[],villageLane=[],southLane=[];
  for(let t=-4960;t<=4960;t+=32){
    valley.push([1520+260*Math.sin(t/680+.4)+130*Math.sin(t/270)+50*Math.sin(t/151),t]);
    northSouth.push([-445+237*Math.sin(t/1350+.3)+99*Math.sin(t/487)+39*Math.sin(t/208),t]);
    villageLane.push([t,-720+95*Math.sin(t/460)+52*Math.sin(t/237)]);
    southLane.push([t,1000+170*Math.sin(t/610)+65*Math.sin(t/312)]);
  }
  const lanes=[
    northSouth,villageLane,southLane,
    [[760,-990],[760,-443],[754,-375],[707,-301],[624,-253],[504,-242],[395,-184],[273,-126],[142,-71]],
    [[882,-990],[882,-1059],[841,-1141],[786,-1243],[767,-1400]],
    [[620,-735],[498,-727],[351,-677],[215,-680],[-40,-707]],
  ];
  for(const z of [-598,-735,-875])lanes.push([[625,z],[986,z]]);
  const roads=new Path2D();for(const lane of lanes)roads.addPath(pathFrom(lane));
  return {water:pathFrom(valley),roads};
}

function drawLand(ctx,view,features,gates){
  const {cx,cy,x,z,yaw,scale:s,width,height}=view;
  ctx.save();ctx.translate(cx,cy);ctx.scale(s,s);ctx.rotate(-yaw);ctx.translate(-x,-z);
  const extent=Math.hypot(width,height)/s;
  // The faint grid is aligned to map north and marks real 500 m intervals.
  ctx.beginPath();
  for(let k=Math.floor((x-extent)/500)*500;k<x+extent;k+=500){ctx.moveTo(k,z-extent);ctx.lineTo(k,z+extent);}
  for(let k=Math.floor((z-extent)/500)*500;k<z+extent;k+=500){ctx.moveTo(x-extent,k);ctx.lineTo(x+extent,k);}
  ctx.lineWidth=0.55/s;ctx.strokeStyle='#c7c8b0';ctx.stroke();
  const stroke=(path,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke(path);};
  stroke(features.water,'#88aaa8',Math.max(48,3.7/s));
  stroke(features.water,'#b6cbc1',Math.max(30,1.7/s));
  ctx.fillStyle='#d9c9aa';ctx.fillRect(606,-1038,402,588);
  ctx.fillStyle='#a78e71';
  for(const zz of [-530,-665,-805,-945])for(const xx of [694,822,941])ctx.fillRect(xx-22,zz-24,44,49);
  for(const [xx,zz] of [[-325,-810],[-422,-745],[-367,-760],[-409,-802],[-471,-830]])ctx.fillRect(xx,zz,24,18);
  ctx.lineJoin='round';ctx.lineCap='round';
  stroke(features.roads,'#b9aa8d',Math.max(14,1.8/s));
  stroke(features.roads,'#f8eed3',Math.max(7,.9/s));
  ctx.fillStyle='#98a37a';ctx.fillRect(-23,-460,46,680);
  ctx.strokeStyle='#6d7d60';ctx.lineWidth=.7/s;ctx.strokeRect(-23,-460,46,680);
  ctx.fillStyle='#f2eacf';for(let zz=-402;zz<219;zz+=97)ctx.fillRect(-3,zz,6,43);
  if(gates.length===4){
    const route=pathFrom([[gates[0].x,gates[0].z],[760,-1120],...gates.slice(1).map(g=>[g.x,g.z])]);
    ctx.setLineDash([3/s,3/s]);stroke(route,'#aa8469',.85/s);
  }
  ctx.restore();
}

function northAndScale(ctx,view,copy){
  ctx.save();ctx.translate(12,12);ctx.rotate(-view.yaw);
  ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(3.4,5);ctx.lineTo(0,3);ctx.lineTo(-3.4,5);ctx.closePath();
  ctx.strokeStyle='#f6f0d9';ctx.lineWidth=2.8;ctx.stroke();ctx.fillStyle='#47564c';ctx.fill();ctx.restore();
  ctx.fillStyle='#3f5047';ctx.textAlign='left';ctx.textBaseline='middle';ctx.font='600 9px Golos, Arial, sans-serif';
  ctx.strokeStyle='#f3eedb';ctx.lineWidth=2.4;ctx.strokeText(copy.north,19,12);ctx.fillText(copy.north,19,12);
  const unit=view.scale*250>21?250:500,span=view.scale*unit,x=5,y=view.height-4;
  ctx.beginPath();ctx.moveTo(x,y-3);ctx.lineTo(x,y);ctx.lineTo(x+span,y);ctx.lineTo(x+span,y-3);
  ctx.lineWidth=2.6;ctx.strokeStyle='#f5efd8';ctx.stroke();ctx.lineWidth=.85;ctx.strokeStyle='#60644f';ctx.stroke();
  ctx.font='500 8px Golos, Arial, sans-serif';ctx.textBaseline='bottom';
  const text=unit+' '+copy.m;ctx.lineWidth=2;ctx.strokeStyle='#f5efd8';ctx.strokeText(text,x,y-2);ctx.fillStyle='#525642';ctx.fillText(text,x,y-2);
}

function drawGate(ctx,p,index,selected,visited){
  const r=selected?7.8:6.1;
  const fill=selected?'#9d4328':visited?'#506e61':'#fbf4de';
  if(p.clipped){
    // A numbered pennant points off the chart precisely along the gate bearing.
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
    ctx.beginPath();ctx.moveTo(0,-r-4);ctx.lineTo(-3.5,-r+1);ctx.lineTo(3.5,-r+1);ctx.closePath();
    ctx.fillStyle=selected?'#923c23':'#6e725e';ctx.strokeStyle='#fff3d7';ctx.lineWidth=1.8;ctx.stroke();ctx.fill();ctx.restore();
  }
  ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);
  ctx.lineWidth=selected?2:1;ctx.fillStyle=fill;ctx.strokeStyle=selected?'#fff1cf':'#8c795c';ctx.fill();ctx.stroke();
  ctx.fillStyle=selected||visited?'#fff7df':'#5e523d';ctx.font=(selected?'bold 10px':'600 9px')+' Golos, Arial, sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(index+1),p.x,p.y+.4);
  if(visited){
    const x=p.x+5,y=p.y+5;
    ctx.fillStyle='#3c6657';ctx.beginPath();ctx.arc(x,y,3.6,0,TAU);ctx.fill();
    ctx.strokeStyle='#fffbe0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-1.7,y);ctx.lineTo(x-.3,y+1.1);ctx.lineTo(x+1.9,y-1.4);ctx.stroke();
  }
}

function paintChart(ctx,w,h,features,state,copy){
  const {gates,selected,aircraft,visited}=state;
  ctx.fillStyle='#e7e5ce';ctx.fillRect(0,0,w,h);
  if(!aircraft||!gates[selected])return;
  const target=gates[selected],range=Math.hypot(target.x-aircraft.x,target.z-aircraft.z);
  const bearing=Math.atan2(target.x-aircraft.x,aircraft.z-target.z)-aircraft.yaw;
  const view=miniView(aircraft,w,h,range,bearing);
  drawLand(ctx,view,features,gates);
  const points=gates.map(g=>projectMiniPoint(view,g));
  const aim=points[selected];
  // Leave the target number legible when it lies directly under the aircraft symbol.
  const display={...aim};
  if(Math.hypot(aim.x-view.cx,aim.y-view.cy)<16){
    display.x=view.cx+Math.sin(aim.angle)*16;display.y=view.cy-Math.cos(aim.angle)*16;
  }
  ctx.beginPath();ctx.moveTo(view.cx,view.cy);ctx.lineTo(display.x,display.y);
  ctx.strokeStyle='#fff4d9';ctx.lineWidth=3.5;ctx.stroke();ctx.strokeStyle='#a0482b';ctx.lineWidth=1.85;ctx.stroke();
  // Keep optional off-map badges from hiding each other, the target, or the aircraft.
  const placed=[display,{x:view.cx,y:view.cy}];
  const others=points.map((p,i)=>({p,i})).filter(({i})=>i!==selected).sort((a,b)=>Number(a.p.clipped)-Number(b.p.clipped));
  for(const {p,i} of others){
    if(placed.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<15))continue;
    if((p.x<35&&p.y<22)||(p.x>w-22&&p.y<22)||(p.x<39&&p.y>h-16))continue;
    drawGate(ctx,p,i,false,visited.has(i));placed.push(p);
  }
  // An ink-blue aircraft always points ahead; meridians and geography rotate beneath it.
  ctx.save();ctx.translate(view.cx,view.cy);
  ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(1.55,-7);ctx.lineTo(1.9,-3);ctx.lineTo(9,-.4);
  ctx.lineTo(9,2);ctx.lineTo(1.75,.9);ctx.lineTo(1.22,5.1);ctx.lineTo(3.8,6.9);ctx.lineTo(3.8,8);
  ctx.lineTo(0,7.2);ctx.lineTo(-3.8,8);ctx.lineTo(-3.8,6.9);ctx.lineTo(-1.22,5.1);ctx.lineTo(-1.75,.9);
  ctx.lineTo(-9,2);ctx.lineTo(-9,-.4);ctx.lineTo(-1.9,-3);ctx.lineTo(-1.55,-7);ctx.closePath();
  ctx.lineJoin='round';ctx.lineWidth=2.4;ctx.strokeStyle='#fff9e5';ctx.stroke();ctx.fillStyle='#233f50';ctx.fill();ctx.restore();
  northAndScale(ctx,view,copy);
  drawGate(ctx,display,selected,true,visited.has(selected));
}

export function createMiniMap(button){
  const features=landmarks();
  button.classList.add('mini-map');button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','trailMap');
  button.innerHTML='<span class="mm-picture"><canvas aria-hidden="true"></canvas><svg aria-hidden="true" class="mm-expand" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 4h7v7M16 4l-9 9M4 6v10h10"/></svg></span><span class="mm-text"><span class="mm-line"><b class="mm-number"></b><strong class="mm-range"></strong><span class="mm-turn"></span></span><span class="mm-altitude"></span></span>';
  const canvas=button.querySelector('canvas'),ctx=canvas.getContext('2d');
  const number=button.querySelector('.mm-number'),range=button.querySelector('.mm-range'),turn=button.querySelector('.mm-turn'),altitude=button.querySelector('.mm-altitude');
  let last=null;
  function redraw(){
    if(!last||!ctx)return;
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const width=Math.round(w*dpr),height=Math.round(h*dpr);
    if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
    ctx.setTransform(width/w,0,0,height/h,0,0);
    paintChart(ctx,w,h,features,last,language[last.lang]||language.en);
  }
  const observer=new ResizeObserver(redraw);observer.observe(canvas);
  function draw({gates=[],selected=0,visited=[],aircraft=null,lang='en',rangeText='',deltaY}){
    const copy=language[lang]||language.en,gate=gates[selected];
    last={gates,selected,visited:visited instanceof Set?visited:new Set(visited||[]),aircraft,lang};
    const relative=aircraft&&gate?Math.atan2(gate.x-aircraft.x,aircraft.z-gate.z)-aircraft.yaw:0;
    const direction=aircraft&&gate?copy[miniCourse(relative)]:'';
    const height=Number.isFinite(deltaY)?deltaY:gate&&aircraft?gate.y-aircraft.y-1.46:null;
    const adjust=Number.isFinite(height)&&Math.abs(height)>6;
    const heightText=height===null?'':adjust?((height>0?'↑ ':'↓ ')+(height>0?copy.climb:copy.descend)+' '+Math.round(Math.abs(height))+' '+copy.m):copy.level;
    number.textContent=String(selected+1);range.textContent=rangeText||'—';turn.textContent=direction;
    altitude.textContent=heightText;altitude.classList.toggle('mm-adjust',adjust);
    const label=[copy.open,copy.target+' '+(selected+1),rangeText,direction,heightText].filter(Boolean).join(' · ');
    button.setAttribute('aria-label',label);button.title=label+' (M)';
    redraw();
  }
  return {draw,dispose:()=>observer.disconnect()};
}
