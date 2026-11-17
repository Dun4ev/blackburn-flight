// A fictional early-twentieth-century commercial district. All coordinates are in metres.
const X=760, grade=22;
const footprint={left:606,right:1008,north:-1038,south:-450};
const rows=[-530,-665,-805,-945], columns=[-66,62,181];
export const districtPlan={
  start:{x:X,z:-242,yaw:0,agl:55}, street:{x:X,zNear:-490,zFar:-990},
  sideStreetX:882, crossStreets:[-598,-735,-875], grade
};
export const districtTrees=[];
for(const x of [X-20,X+20,882-14.5,882+14.5])for(let z=-967;z<=-510;z+=49){
  if(districtPlan.crossStreets.every(j=>Math.abs(j-z)>15))districtTrees.push([x,z,5.0+1.4*Math.sin(x+z)]);
}
export function clearsDistrict(x,z,margin=0) {
  return x<footprint.left-margin||x>footprint.right+margin||z<footprint.north-margin||z>footprint.south+margin;
}
export function districtHeight(x,z,natural) {
  const dx=Math.max(footprint.left-16-x,x-footprint.right-16,0);
  const dz=Math.max(footprint.north-16-z,z-footprint.south-16,0);
  const t=Math.min(1,Math.hypot(dx,dz)/105);
  return grade + (natural-grade)*t*t*(3-2*t);
}
export function paintDistrictLanes(c) {
  c.save();c.lineCap='round';
  function road(points) {
    for(const [color,width] of [['#858369',12],['#c0b496',7.8]]) {
      c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(...points[0]);
      for(let i=1;i<points.length;i++)c.lineTo(...points[i]);c.stroke();
    }
  }
  road([[760,-975],[760,-443],[754,-375],[707,-301],[624,-253],[504,-242],[395,-184],[273,-126],[142,-71]]);
  road([[882,-990],[882,-1059],[841,-1141],[786,-1243],[767,-1400]]);
  road([[620,-735],[498,-727],[351,-677],[215,-680],[-40,-707]]);
  c.restore();
}

const schemes=[
  {brick:'#a47560',mortar:'#c1a58a',trim:'#cbbca1',glass:'#556572',type:'arch'},
  {brick:'#bcaa8b',mortar:'#d2c1a5',trim:'#ded0ae',glass:'#5a6972',type:'stone'},
  {brick:'#967468',mortar:'#aa9584',trim:'#d3bca0',glass:'#4d5c65',type:'pair'},
  {brick:'#a78560',mortar:'#c0a587',trim:'#d8c9ac',glass:'#475a61',type:'arch'},
  {brick:'#9b6354',mortar:'#b69279',trim:'#bda58c',glass:'#52656e',type:'pair'},
  {brick:'#a7aba2',mortar:'#c2c3b7',trim:'#d4ceba',glass:'#52636a',type:'stone'}
];
const styles=[
  ['EXCHANGE',0,78,'clock'],['GRAND HOTEL',1,86,'mansard'],['MERCANTILE',2,62,'lantern'],
  ['THE CHRONICLE',3,98,'steps'],['VICTORIA HOUSE',4,73,'copper'],['CENTRAL WORKS',0,66,'shoulders'],
  ['UNION HALL',5,83,'pyramid'],['MIDLAND ASSURANCE',3,95,'shoulders'],['IMPERIAL HOUSE',1,76,'mansard'],
  ['MERCHANTS HOUSE',4,80,'lantern'],['THE HERALD',2,102,'steps'],['STATION HOTEL',5,65,'copper']
];
const widths=[61,54,54,58,53,55,59,54,54,57,52,53];
const depths=[75,66,62,70,78,69,74,73,68,75,77,71];
function canvas(w,h=w){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function rng(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
function imageTexture(T,canvas,repeat=false) {
  const tx=new T.CanvasTexture(canvas);tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=4;
  if(repeat)tx.wrapS=tx.wrapT=T.RepeatWrapping;return tx;
}
function facade(T,scheme,index) {
  const c=canvas(384,384),g=c.getContext('2d'),r=rng(index*419+303);
  const tile=128;
  g.fillStyle=scheme.mortar;g.fillRect(0,0,384,384);
  const stone=scheme.type==='stone', course=stone?11:4, brick=stone?39:15;
  for(let iy=-1;iy<=384/course;iy++)for(let xx=-brick;xx<384;xx+=brick) {
    const x=xx+(iy%2)*brick*.5,y=iy*course;
    g.fillStyle=scheme.brick;g.fillRect(x,y,brick-.65,course-.5);
    g.fillStyle='rgba('+(r()>.52?'255,242,211,':'46,36,31,')+(r()*.15)+')';
    g.fillRect(x,y,brick-.8,course-.65);
  }
  function windowFrame(x,y,w,h,arch){
    const t=arch?11:0;
    g.fillStyle='rgba(44,38,36,.35)';g.fillRect(x-2,y+4,w+6,h+7);
    g.fillStyle=scheme.trim;
    g.beginPath();g.moveTo(x-3,y+h+2);g.lineTo(x-3,y+t);
    if(arch)g.quadraticCurveTo(x+w*.5,y-16,x+w+3,y+t);else g.lineTo(x+w+3,y);
    g.lineTo(x+w+3,y+h+2);g.fill();
    const fill=g.createLinearGradient(0,y,0,y+h);fill.addColorStop(0,scheme.glass);fill.addColorStop(.52,'#788582');fill.addColorStop(1,'#423f3c');
    g.fillStyle='#51493f';g.fillRect(x,y+t,w,h-t);
    if(arch){g.beginPath();g.moveTo(x,y+t);g.quadraticCurveTo(x+w*.5,y-10,x+w,y+t);g.fill();}
    g.fillStyle=fill;g.fillRect(x+2,y+t+1,w-4,h-t-3);
    if(r()>.35){g.fillStyle=r()>.5?'#b8a78d':'#a39881';g.fillRect(x+2,y+t+2,w-4,3+Math.floor(r()*h*.24));}
    g.fillStyle='#c1b29a';g.fillRect(x+w*.5-1,y+t,1.5,h-t);g.fillRect(x,y+h*.48,w,2.2);
    g.fillStyle='#d1bea0';g.fillRect(x-5,y+h,w+10,3);
    g.fillStyle='rgba(47,40,35,.36)';g.fillRect(x-4,y+h+3,w+9,2);
  }
  for(let j=0;j<3;j++)for(let i=0;i<3;i++) {
    const x=i*tile,y=j*tile;
    g.fillStyle=scheme.trim;g.fillRect(x,y,4,128);g.fillRect(x+6,y,1.2,128);
    g.fillStyle='rgba(48,41,36,.3)';g.fillRect(x+4,y,2,128);
    if(scheme.type==='pair'){
      windowFrame(x+20,y+23,39,78,false);windowFrame(x+69,y+23,39,78,false);
      g.fillStyle=scheme.trim;g.fillRect(x+15,y+19,98,4);
    }else{
      windowFrame(x+30,y+23,69,80,scheme.type==='arch');
      if(stone){g.fillStyle=scheme.trim;g.fillRect(x+22,y+17,86,4);}
    }
    g.fillStyle='rgba(62,52,44,.20)';g.fillRect(x,y+118,128,2);
    if(stone){g.fillStyle=scheme.trim;g.fillRect(x,y+116,128,2);}
  }
  return new T.MeshLambertMaterial({map:imageTexture(T,c,true)});
}
function arcade(T,scheme,index) {
  const c=canvas(384,384),g=c.getContext('2d'),rand=rng(index*71+3);
  g.fillStyle=scheme.trim;g.fillRect(0,0,384,384);
  for(let line=0;line<24;line++){
    g.fillStyle='rgba(90,77,62,.28)';g.fillRect(0,line*16,384,1);
    for(let x=(line%2)*24;x<384;x+=48)g.fillRect(x,line*16,1,16);
  }
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){
    const x=i*128,y=j*128;
    g.fillStyle='#887760';g.fillRect(x+14,y+20,102,100);
    g.fillStyle='#514b41';g.fillRect(x+17,y+23,96,94);
    const gr=g.createLinearGradient(x,y+29,x+45,y+105);gr.addColorStop(0,'#6f838a');gr.addColorStop(.6,'#48565a');gr.addColorStop(1,'#3e4140');
    g.fillStyle=gr;g.fillRect(x+21,y+39,88,70);
    g.fillStyle=scheme.trim;g.fillRect(x+63,y+38,3,72);g.fillRect(x+21,y+63,88,3);
    g.fillStyle='#aa9a79';g.fillRect(x+19,y+31,92,2);g.fillRect(x+19,y+109,92,3);
    g.fillStyle=rand()>.5?'#88715c':'#8c8267';g.fillRect(x+20,y+23,89,6);
    g.fillStyle='#ad9c82';g.fillRect(x+6,y+13,116,5);
    g.fillStyle='#a19884';g.fillRect(x+6,y+110,5,16);g.fillRect(x+117,y+110,5,16);
  }
  return new T.MeshLambertMaterial({map:imageTexture(T,c,true)});
}
function roofSheet(T,copper){
  const c=canvas(256),g=c.getContext('2d'),r=rng(copper?118:620);
  g.fillStyle=copper?'#69817a':'#626b71';g.fillRect(0,0,256,256);
  for(let col=0;col<8;col++)for(let row=-1;row<5;row++){
    const x=col*32,y=row*64+(col%2)*32;
    g.fillStyle='rgba('+(r()>.45?'215,212,189,':'37,46,44,')+(.025+r()*.063)+')';g.fillRect(x,y,32,64);
    g.fillStyle='rgba(41,47,47,.34)';g.fillRect(x,y,1.5,64);g.fillRect(x,y,32,1.4);
    g.fillStyle='rgba(205,207,182,.25)';g.fillRect(x+1.5,y,.95,64);
  }
  for(let i=0;i<1250;i++){g.fillStyle='rgba(47,52,48,.07)';g.fillRect(r()*256,r()*256,.7+r(),2+r()*7);}
  return new T.MeshLambertMaterial({map:imageTexture(T,c,true)});
}
function clockFace(T) {
  const c=canvas(384),g=c.getContext('2d'),M=192;
  g.fillStyle='#937d56';g.fillRect(0,0,384,384);
  g.translate(M,M);
  for(const [r,color] of [[188,'#49483d'],[175,'#b5a071'],[165,'#eee2c3'],[154,'#d6c7a2'],[150,'#e7dbb7']]){
    g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.fillStyle=color;g.fill();
  }
  g.strokeStyle='#554c38';g.lineWidth=2.5;
  for(let i=0;i<60;i++){g.save();g.rotate(i*Math.PI/30);g.beginPath();g.moveTo(0,-149);g.lineTo(0,i%5?-143:-139);g.stroke();g.restore();}
  g.font='bold 27px Georgia,serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#38392e';
  const roman=['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
  roman.forEach((n,i)=>{const a=i*Math.PI/6;g.fillText(n,Math.sin(a)*123,-Math.cos(a)*123);});
  for(const [a,w,l] of [[.93,8,82],[-1.1,5,117]]){g.save();g.rotate(a);g.beginPath();g.moveTo(-w,18);g.lineTo(-w*.54,-l*.72);g.lineTo(0,-l);g.lineTo(w*.54,-l*.72);g.lineTo(w,18);g.fill();g.restore();}
  g.beginPath();g.arc(0,0,9,0,Math.PI*2);g.fill();
  return new T.MeshLambertMaterial({map:imageTexture(T,c)});
}
function signFace(T,words){
  const c=canvas(768,96),g=c.getContext('2d');
  g.fillStyle='#514b43';g.fillRect(0,0,768,96);
  g.strokeStyle='#bda47b';g.lineWidth=3;g.strokeRect(5,5,758,86);
  g.strokeStyle='#877b62';g.lineWidth=1;g.strokeRect(10,10,748,76);
  g.font='bold 54px Georgia,serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#e2ceaa';g.fillText(words,384,51,715);
  return new T.MeshLambertMaterial({map:imageTexture(T,c)});
}
function rect(cx,cz,w,d,bevel=0) {
  const a=w/2,b=d/2,k=Math.min(bevel,a*.6,b*.6);
  return (k>0?[[-a+k,-b],[a-k,-b],[a,-b+k],[a,b-k],[a-k,b],[-a+k,b],[-a,b-k],[-a,-b+k]]:[[-a,-b],[a,-b],[a,b],[-a,b]]).map(([x,z])=>[cx+x,cz+z]);
}
function ring(cx,cz,rx,rz,n=12){return Array.from({length:n},(_,i)=>{const a=i*2*Math.PI/n;return [cx+rx*Math.cos(a),cz+rz*Math.sin(a)];});}
function scaled(poly,f){const n=poly.length,cx=poly.reduce((s,p)=>s+p[0],0)/n,cz=poly.reduce((s,p)=>s+p[1],0)/n;return poly.map(([x,z])=>[cx+(x-cx)*f,cz+(z-cz)*f]);}

function districtGround(T,group) {
  const w=footprint.right-footprint.left,h=footprint.south-footprint.north;
  const c=canvas(1024,1536),g=c.getContext('2d'),r=rng(82241);
  g.setTransform(c.width/w,0,0,c.height/h,-footprint.left*c.width/w,-footprint.north*c.height/h);
  g.lineCap='butt';
  const streets=[
    ...[625,X,882,985].map(x=>[x,-1021,x,-463]),
    ...[-1004,-875,-735,-598,-479].map(z=>[618,z,992,z])
  ];
  function drawWay(way,col,width) {
    g.strokeStyle=col;g.lineWidth=width;g.beginPath();g.moveTo(way[0],way[1]);g.lineTo(way[2],way[3]);g.stroke();
  }
  for(let row=0;row<4;row++)for(let col=0;col<3;col++){
    const x=X+columns[col],z=rows[row],left=[629,765,887][col],right=[754,877,981][col];
    const north=[-593,-730,-870,-999][row],south=[-484,-603,-740,-880][row];
    g.fillStyle=['#9b947e','#a69d84','#918e7a'][(row+col)%3];g.fillRect(left,north,right-left,south-north);
    g.fillStyle='#a79b84';g.fillRect(x-35,z-43,70,87);
    for(let k=0;k<75;k++){g.fillStyle=k%2?'rgba(201,188,151,.14)':'rgba(70,66,54,.11)';g.fillRect(left+r()*(right-left),north+r()*(south-north),3+r()*7,2+r()*7);}
  }
  for(const way of streets)drawWay(way,'#ad9e83',way[0]===X?32:19);
  for(const way of streets)drawWay(way,'#8a8273',way[0]===X?25:13.5);
  for(const way of streets)drawWay(way,'#817d70',way[0]===X?23:12);
  for(const [x,z,treeH] of districtTrees) {
    g.fillStyle='rgba(48,55,43,.23)';g.beginPath();g.ellipse(x+treeH*.48,z+treeH*.45,treeH*.70,treeH*.30,.78,0,2*Math.PI);g.fill();
    g.fillStyle='#8f8968';g.fillRect(x-.9,z-.9,1.8,1.8);
  }
  // Cobbles are mottled individually at ground scale and merge into an even carriageway aloft.
  g.save();g.globalCompositeOperation='source-atop';
  for(let k=0;k<53000;k++){
    g.fillStyle=k%2?'rgba(33,34,29,.074)':'rgba(222,212,184,.11)';
    g.fillRect(footprint.left+r()*w,footprint.north+r()*h,.45+r()*.65,.25+r()*.42);
  }
  for(const side of [-1,1])for(const p of [-.68,.68])drawWay([X+side*3.3+p,-1003,X+side*3.3+p,-478],'#55534c',.31);
  // Baked low sun shadows reach down the streets; real-time shadows track the aircraft nearby.
  for(let j=0;j<4;j++)for(let i=0;i<3;i++){
    const n=j*3+i,x=X+columns[i],z=rows[j],w=widths[n],d=depths[n],dx=styles[n][2]*.77,dz=dx*.9;
    g.beginPath();g.moveTo(x-w*.5,z+d*.5);g.lineTo(x+w*.5,z-d*.5);g.lineTo(x+w*.5+dx,z-d*.5+dz);
    g.lineTo(x+w*.5+dx,z+d*.5+dz);g.lineTo(x-w*.5+dx,z+d*.5+dz);g.closePath();g.fillStyle='rgba(45,48,49,.26)';g.fill();
  }
  g.restore();
  const map=imageTexture(T,c);const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshLambertMaterial({map,alphaTest:.3}));
  mesh.rotation.x=-Math.PI/2;mesh.position.set((footprint.left+footprint.right)/2,grade+.10,(footprint.north+footprint.south)/2);
  mesh.receiveShadow=true;group.add(mesh);
}
export function makeTowerDistrict(T,world){
  const group=new T.Group();group.name='Edwardian commercial quarter';world.add(group);
  districtGround(T,group);
  const faces=new Map(),hurts=[];
  const mat=c=>new T.MeshLambertMaterial({color:c});
  const facadeMats=schemes.map((s,i)=>facade(T,s,i)),arcades=schemes.map((s,i)=>arcade(T,s,i));
  const cornices=schemes.map(s=>mat(s.trim)), roof=roofSheet(T,false),copper=roofSheet(T,true),slate=roof;
  const granite=mat('#a49b87'),bronze=mat('#797152'),stone=mat('#c4b49a'),dark=mat('#4c514a'),glass=mat('#cbb87e');
  const clock=clockFace(T), positions=[];
  function batch(m){if(!faces.has(m))faces.set(m,{p:[],uv:[],ix:[]});return faces.get(m);}
  function quad(m,a,b,c,d,uw=1,uh=1){
    const mesh=batch(m),k=mesh.p.length/3;
    mesh.p.push(...a,...b,...c,...d);mesh.uv.push(0,0,0,uh,uw,uh,uw,0);
    mesh.ix.push(k,k+1,k+2,k,k+2,k+3);
  }
  function fan(m,poly,y){
    const b=batch(m),k=b.p.length/3;
    for(const [x,z] of poly){b.p.push(x,y,z);b.uv.push(x/10,z/10);}
    for(let i=1;i<poly.length-1;i++)b.ix.push(k,k+i+1,k+i);
  }
  function plane(a,b,c) {
    const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    let nx=u[1]*v[2]-u[2]*v[1],ny=u[2]*v[0]-u[0]*v[2],nz=u[0]*v[1]-u[1]*v[0];
    const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
    return [nx,ny,nz,nx*a[0]+ny*a[1]+nz*a[2]];
  }
  function block(poly,lo,hi,m,top=poly,collide=true,bay=4.05,level=3.75,cap=roof) {
    const base=grade+lo,peak=grade+hi;
    const planes=[[0,-1,0,-base],[0,1,0,peak]];
    for(let j=0;j<poly.length;j++){
      const k=(j+1)%poly.length,[x,z]=poly[j],[xx,zz]=poly[k],[tx,tz]=top[j],[ux,uz]=top[k];
      const a=[x,base,z],b=[tx,peak,tz],c=[ux,peak,uz],d=[xx,base,zz];
      const windowCount=Math.max(1,Math.round(Math.hypot(x-xx,z-zz)/bay));
      const floorCount=Math.max(1,Math.round((hi-lo)/level));
      quad(m,a,b,c,d,windowCount/3,floorCount/3);
      if(collide)planes.push(plane(a,b,c));
    }
    fan(cap,top,peak);
    if(collide){
      const all=[...poly,...top],xs=all.map(p=>p[0]),zs=all.map(p=>p[1]);
      hurts.push({xmin:Math.min(...xs),xmax:Math.max(...xs),zmin:Math.min(...zs),zmax:Math.max(...zs),ymin:base,ymax:peak,planes});
    }
  }
  function cornice(shape,h,m,heavy=false){
    const sh=scaled(shape,heavy?1.037:1.022);
    block(shape,h-.83,h-.55,m,sh,false);block(sh,h-.55,h,m,sh,true,6,5,m);
  }
  // Wall banners and clock dials have conventional UVs independent of face winding.
  function panel(m,x,y,z,w,h,nx,nz){
    const rx=nz,rz=-nx, b=batch(m),k=b.p.length/3;
    b.p.push(x-rx*w/2,y-h/2,z-rz*w/2,x+rx*w/2,y-h/2,z+rz*w/2,
             x+rx*w/2,y+h/2,z+rz*w/2,x-rx*w/2,y+h/2,z-rz*w/2);
    b.uv.push(0,0,1,0,1,1,0,1);b.ix.push(k,k+1,k+2,k,k+2,k+3);
  }
  function cupola(x,z,base,r,tall,roofmat) {
    let old=ring(x,z,r,r);
    const drum=ring(x,z,r*.86,r*.86);
    block(old,base,base+1,stone,drum,true,4,5,stone);
    block(drum,base+1,base+tall*.27,bronze,drum);
    const profile=[[.30,.98],[.44,1.0],[.62,.81],[.78,.53],[.90,.25],[1,.055]];
    let last=base+tall*.27;old=drum;
    for(const [f,rad] of profile){const next=ring(x,z,r*rad,r*rad);block(old,last,base+tall*f,roofmat,next,true,4,5,roofmat);last=base+tall*f;old=next;}
  }
  function clockTower(x,z,lo,side,trim){
    const body=rect(x,z,17.8,17.8,.9),cab=rect(x,z,19,19,.9), crown=rect(x,z,17.4,17.4,1.0);
    block(body,lo,lo+21,side);cornice(body,lo+20.8,trim,true);block(cab,lo+20.8,lo+33.8,trim,cab,true,5,4,trim);
    for(const [nx,nz] of [[1,0],[0,1],[-1,0],[0,-1]])panel(clock,x+nx*9.53,grade+lo+27.6,z+nz*9.53,10.25,10.25,nx,nz);
    cornice(cab,lo+34,trim,true);
    block(crown,lo+34,lo+39,slate,scaled(crown,.64),true);
    cupola(x,z,lo+39,5.8,12.2,copper);
  }
  for(let row=0;row<4;row++)for(let col=0;col<3;col++){
    const i=row*3+col,[label,s,h,style]=styles[i], m=facadeMats[s],trim=cornices[s];
    const x=X+columns[col],z=rows[row],w=widths[i],d=depths[i],b=rect(x,z,w,d,i%3===0?5.8:2.3);
    positions.push({name:label,x,z});
    block(b,-.3,.62,granite);block(b,.62,8.98,arcades[s],b,true,5.4,8.3);cornice(b,9.18,trim,true);
    // A projecting entrance pavilion and paired stone piers connect the tower to the pavement.
    const porchZ=z+d/2+2,fr=rect(x,porchZ,13.8,4.7,.4);
    block(fr,.1,.52,granite,fr,true);
    for(const dx of [-5.8,-4.3,4.3,5.8]){
      const pl=rect(x+dx,porchZ+1.45,.70,.72);
      block(pl,.5,5.65,trim,scaled(pl,.81),true);
    }
    block(fr,5.65,6.37,trim);block(fr,6.37,7.82,slate,scaled(fr,.67));
    const recess=rect(x,z+d/2+.12,5.7,.35);
    block(recess,.5,5.44,dark,recess,false);
    const doors=rect(x,z+d/2+.34,4.5,.28);
    block(doors,.50,4.80,arcades[s],doors,false,2.3,4.3);

    // Upper courses keep a planar facade for windows, while projecting string courses and piers give parallax.
    const h1=h*(style==='clock'?.70:style==='steps'?.57:style==='shoulders'?.63:.72), main=scaled(b,.98);
    block(main,9.18,h1,m,main);cornice(main,h1,trim,true);
    for(const f of [.40,.72]){
      const hh=10+(h1-10)*f;block(scaled(main,1.005),hh,hh+.39,trim,scaled(main,1.005),false);
    }
    if(i%3!==1){
      for(const sx of [-1,1])for(const f of [-.32,0,.32]){
        const pier=rect(x+sx*w*.488,z+d*f,.54,1.17);
        block(pier,9.1,h1-.6,trim,pier,false,4,5,trim);
      }
    }
    // The projecting frieze carries a period sign large enough to read on approach.
    const signH=3.05,signY=h1-4.1;
    const signW=Math.min(w*.67,Math.max(16,label.length*1.9)), front=z+d*.49+.065;
    panel(signFace(T,label),x,grade+signY,front,signW,signH,0,1);
    if(style==='clock'){
      const p=rect(x-5,z-10,w*.64,d*.53,3.5);block(p,h1,h1+9,m);cornice(p,h1+9.25,trim,true);
      clockTower(x+w*.238,z+d*.25,h1-1.5,m,trim);
    }else if(style==='steps'){
      let prev=h1;
      for(const [f,ww,dd] of [[.73,.76,.72],[.86,.54,.53],[.98,.32,.37]]){
        const p=rect(x,z,w*ww,d*dd,2.7);block(p,prev,h*f,m);cornice(p,h*f,trim,true);prev=h*f;
      }
      const last=rect(x,z,w*.31,d*.35,2.4);block(last,prev,h+8,copper,scaled(last,.39));
      cupola(x,z,h+8,1.6,4.4,bronze);
    }else if(style==='mansard'){
      const p=rect(x,z,w*.90,d*.88,2.4);
      block(p,h1,h*.87,m);cornice(p,h*.87,trim,true);
      block(p,h*.87,h,slate,scaled(p,.72),true,4,5,slate);
      for(const sx of [-1,1])for(const sz of [-1,1]){
        const xx=x+sx*w*.36,zz=z+sz*d*.36,t=rect(xx,zz,6.3,7.3,.6);
        block(t,h*.83,h*.94,trim);block(t,h*.94,h*1.013,slate,scaled(t,.08));
      }
    }else if(style==='copper'||style==='lantern'){
      const p=rect(x,z,w*.70,d*.65,4);block(p,h1,h*.87,m);cornice(p,h*.87,trim,true);
      const xx=x+(i%2?-.12: .13)*w,zz=z+.12*d;
      const drum=ring(xx,zz,w*.195,w*.195,8);
      block(drum,h*.87,h*.99,m,drum,true,3.8,4);
      cornice(drum,h*.99,trim,true);cupola(xx,zz,h*.99,w*.19,style==='lantern'?16:12,copper);
    }else if(style==='pyramid'){
      const p=rect(x,z,w*.67,d*.67,1.8);block(p,h1,h*.88,m);cornice(p,h*.88,trim,true);
      block(p,h*.88,h+15,copper,scaled(p,.12),true,5,5,copper);
    }else{
      const p=rect(x,z,w*.56,d*.75,2.6);block(p,h1,h*.85,m);cornice(p,h*.85,trim,true);
      const t=rect(x,z-4,w*.35,d*.51,2);block(t,h*.85,h,m);cornice(t,h,trim,true);
      block(t,h,h+4.6,slate,scaled(t,.72),true,4,5,slate);
    }
    // Low buildings join the tall blocks to the surrounding streets.
    for(const edge of [-1,1]){
      const xx=x+edge*(w/2+4.1),zz=z+(edge<0?-1:1)*d*.17;
      const p=rect(xx,zz,7.2,d*.58,1.1),top=9+(i+col+(edge<0?0:3))%5*2.15;
      block(p,.1,top,m,p,true,3.5,3.2);cornice(p,top,trim);
      block(p,top,top+2.3,slate,scaled(p,.80));
    }
  }
  // Low street-front terraces soften the transition from fields to the commercial quarter.
  const terraceRoof=mat('#826557');
  for(const z of [-461,-1019])for(const [k,xx] of [649,702,820,940].entries()){
    const w=k===0?24:32,d=10,wall=arcades[(k+2)%arcades.length], upper=facadeMats[(k+1)%facadeMats.length];
    const p=rect(xx,z,w,d,.55);block(p,.15,3.9,wall,p,true,4,3.7);block(p,3.9,9.05,upper,p,true,3.6,3.1);
    cornice(p,9.15,stone);
    block(p,9.15,12.2,terraceRoof,rect(xx,z,w*.94,1.1,.35),true);
    for(const dx of [-w*.32,w*.34]){
      const chimney=rect(xx+dx,z+.6,.9,1.0);block(chimney,11,13.3,stone,chimney,false);
    }
  }
  // Pointed finials and gas lamps anchor the scale at the foot of the towers.
  for(const xx of [X-15,X+15,882-10.6,882+10.6])for(let z=-978;z<-480;z+=32){
    if(districtPlan.crossStreets.some(k=>Math.abs(z-k)<10))continue;
    const p=ring(xx,z,.22,.22,6),cap=ring(xx,z,.46,.46,6);
    block(p,.1,3.2,dark,scaled(p,.62),false);
    block(scaled(cap,.52),3.2,4.14,glass,cap,false);
    block(cap,4.14,4.48,dark,scaled(cap,.08),false);
  }
  for(const [m,data] of faces){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(data.p,3));g.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));
    g.setIndex(data.ix);g.computeVertexNormals();g.computeBoundingSphere();
    const mesh=new T.Mesh(g,m);mesh.receiveShadow=true;mesh.castShadow=true;group.add(mesh);
  }
  // Segment clipping against the convex walls of each individual tier also handles sloped roofs.
  const right=new T.Vector3(),up=new T.Vector3(),tail=new T.Vector3(),q=new T.Quaternion(),euler=new T.Euler(0,0,0,'YXZ');
  function trace(a,b,hull) {
    const pad=hull?6.5:.62;
    const xmin=Math.min(a.x,b.x)-pad,xmax=Math.max(a.x,b.x)+pad,zmin=Math.min(a.z,b.z)-pad,zmax=Math.max(a.z,b.z)+pad;
    if(xmax<footprint.left||xmin>footprint.right||zmax<footprint.north||zmin>footprint.south)return Infinity;
    const ymin=Math.min(a.y,b.y)-pad,ymax=Math.max(a.y,b.y)+pad;
    const vx=b.x-a.x,vy=b.y-a.y,vz=b.z-a.z;
    let nearest=Infinity;
    for(const solid of hurts) {
      if(xmax<solid.xmin||xmin>solid.xmax||zmax<solid.zmin||zmin>solid.zmax||ymax<solid.ymin||ymin>solid.ymax)continue;
      let enter=0,exit=1;
      for(const [nx,ny,nz,d] of solid.planes) {
        let offset=.6;
        if(hull) {
          const cross=nx*right.x+ny*right.y+nz*right.z;
          const lift=nx*up.x+ny*up.y+nz*up.z;
          const back=nx*tail.x+ny*tail.y+nz*tail.z;
          offset=Math.abs(cross)*hull[0]+Math.abs(lift)*hull[1]+Math.abs(back)*hull[2]-lift*hull[3]-back*hull[4];
        }
        const slack=d+offset-(nx*a.x+ny*a.y+nz*a.z),slope=nx*vx+ny*vy+nz*vz;
        if(Math.abs(slope)<1e-8) {if(slack<0){exit=-1;break;}continue;}
        if(slope>0)exit=Math.min(exit,slack/slope);else enter=Math.max(enter,slack/slope);
        if(enter>exit)break;
      }
      if(enter<=exit)nearest=Math.min(nearest,enter);
    }
    return nearest;
  }
  // Half-extents and centre offsets are relative to the bottom of the undercarriage.
  const wing=[4.8578,.18,.99,1.65,-.15],body=[.59,1.30,3.99,1.30,1.22],tailplane=[1.71,.14,.78,1.50,4.45];
  function hits(x,y,z,previous,attitude) {
    const b={x,y,z},a=previous||b;
    if((Math.min(x,a.x)>footprint.right+7)||(Math.max(x,a.x)<footprint.left-7)||
       (Math.min(z,a.z)>footprint.south+7)||(Math.max(z,a.z)<footprint.north-7))return false;
    q.setFromEuler(euler.set(attitude?.pitch||0,-(attitude?.yaw||0),-(attitude?.roll||0),'YXZ'));
    right.set(1,0,0).applyQuaternion(q);up.set(0,1,0).applyQuaternion(q);tail.set(0,0,1).applyQuaternion(q);
    return Number.isFinite(trace(a,b,wing))||Number.isFinite(trace(a,b,body))||Number.isFinite(trace(a,b,tailplane));
  }
  function clipCamera(origin,end) {
    const t=trace(origin,end,null);
    if(!Number.isFinite(t))return 1;
    const length=Math.hypot(end.x-origin.x,end.y-origin.y,end.z-origin.z);
    return Math.max(0,Math.min(1,t-.06/Math.max(.01,length)));
  }
  return {...districtPlan, buildings:positions, hits, clipCamera};
}
