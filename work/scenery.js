import { makeTowerDistrict, clearsDistrict, districtHeight, districtTrees, paintDistrictLanes } from './tower-district.js';

// Procedural summer landscape. Meters in a right-handed Y-up world.
export function makeScenery(T, scene, renderer) {
  let seed = 0x446178;
  function random() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const between = (a, b) => a + (b - a) * random();
  const smooth = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const world = new T.Group();
  world.name = 'Bedfordshire landscape';
  scene.add(world);
  const palette = ['#989e56', '#808e50', '#9ca365', '#b2ab68', '#a4a15b',
    '#7f8e4d', '#9b9c54', '#a9a25d', '#b2a46b', '#a1a25a', '#8f9b64',
    '#bfa76b', '#b8a567', '#97885a', '#a49662', '#7c9258', '#aaa869'];
  const extent = 9400;
  const riverX = z => 1520 + 260 * Math.sin(z / 680 + 0.4) + 130 * Math.sin(z / 270) + 50 * Math.sin(z / 151);
  const riverWidth = z => 18 + 3.3 * Math.sin(z / 285) + 2.1 * Math.sin(z / 127);
  function heightAt(x, z) {
    const r = Math.hypot(x * 0.98, z);
    const runwayDistance = Math.hypot(
      Math.max(0, Math.abs(x - 25) - 111),
      Math.max(0, Math.abs(z + 100) - 373));
    const rise = smooth(0, 590, runwayDistance);
    const base = 22 + 11 * Math.sin(x / 527 + z / 840)
      + 14 * Math.sin(z / 477 - x / 980) + 7 * Math.sin((x + z) / 277)
      + 5 * Math.sin(z / 194 + 1.2) * Math.cos(x / 253);
    const downs = smooth(1350, 8800, r) * (95 + 66 * Math.sin(x / 1480 + z / 1800)
      + 59 * Math.sin(z / 1090 - x / 1220 + 1.1) + 31 * Math.cos(x / 644 + z / 1130));
    const d = Math.abs(x - riverX(z));
    const valley = smooth(15, 295, d);
    return districtHeight(x,z,-2.8 * (1 - valley) + (base * rise + downs) * valley);
  }
  const color = c => new T.Color(c);
  const lambert = (c, props = {}) => new T.MeshLambertMaterial({ color: c, ...props });
  const attach = (geo, material, parent = world) => {
    const item = new T.Mesh(geo, material);
    parent.add(item);
    return item;
  };
  const skyDirection = new T.Vector3(-0.62, 0.38, -0.61).normalize();
  const fogTint = '#bdc7c4';
  scene.fog = new T.FogExp2(fogTint, 0.000145);
  scene.background = color('#afc7ce');
  const hemisphere = new T.HemisphereLight(0xe5f2ff, 0xb5a884, 1.28);
  scene.add(hemisphere);
  const sun = new T.DirectionalLight(0xffecd1, 2.15);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -33; sc.right = 33; sc.top = 33; sc.bottom = -33;
  sc.near = 1; sc.far = 195; sc.updateProjectionMatrix();
  sun.shadow.normalBias = 0.024;
  sun.shadow.bias = -0.00035;

  function canvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  }
  function colorTexture(c, repeat = false) {
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.flipY = false;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (repeat) tex.wrapS = tex.wrapT = T.RepeatWrapping;
    return tex;
  }
  function cloudNoise() {
    const sz = 512, out = canvas(sz), ctx = out.getContext('2d');
    const data = ctx.createImageData(sz, sz);
    const bands = [4, 8, 16, 32, 64, 128].map(n => {
      const v = new Float32Array(n * n);
      for (let i = 0; i < v.length; i++) v[i] = random();
      return { n, v };
    });
    for (let y = 0, p = 0; y < sz; ++y) {
      for (let x = 0; x < sz; ++x, p += 4) {
        let sum = 0, amp = 0.5;
        for (const {n,v} of bands) {
          const fx = x * n / sz, fy = y * n / sz;
          const ax = Math.floor(fx), ay = Math.floor(fy), bx = (ax + 1) % n, by = (ay + 1) % n;
          let u = fx - ax, t = fy - ay;
          u = u * u * (3 - 2 * u); t = t * t * (3 - 2 * t);
          sum += amp * ((v[ay*n+ax] * (1-u) + v[ay*n+bx] * u) * (1-t) +
            (v[by*n+ax] * (1-u) + v[by*n+bx] * u) * t);
          amp *= 0.5;
        }
        data.data[p] = data.data[p+1] = data.data[p+2] = Math.round(255 * sum);
        data.data[p+3] = 255;
      }
    }
    ctx.putImageData(data, 0, 0);
    const tex = new T.CanvasTexture(out);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    return tex;
  }
  const noise = cloudNoise();
  const skyMaterial = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { cloudMap: {value: noise}, towardsSun: {value: skyDirection}, elapsed: {value: 0} },
    vertexShader: `varying vec3 direction;
      void main() { direction = position; vec4 clip = projectionMatrix * modelViewMatrix * vec4(position,1.);
      gl_Position = clip.xyww; }`,
    fragmentShader: `varying vec3 direction;
      uniform sampler2D cloudMap;
      uniform vec3 towardsSun;
      uniform float elapsed;
      float billows(vec2 uv) {
        vec2 warp = vec2(texture2D(cloudMap, uv * 1.42 + .231).x,
                         texture2D(cloudMap, uv * 1.24 + .628).x) - .5;
        return texture2D(cloudMap, uv + .102 * warp).x * .76
             + texture2D(cloudMap, uv * 2.81 + .137 + warp * .037).x * .17
             + texture2D(cloudMap, uv * 7.9 + .627).x * .07;
      }
      void main() {
        vec3 d = normalize(direction);
        float h = max(d.y,0.0), mu = clamp(dot(d,towardsSun),-1.,1.);
        float air = exp(-h * 3.75);
        vec3 zenith = vec3(.075,.227,.466);
        vec3 rim = mix(vec3(.56,.676,.711), vec3(.94,.724,.463), pow(max(0.,mu),4.));
        vec3 sky = mix(zenith,rim,air);
        sky += vec3(.19,.146,.080) * pow(max(0.,mu),18.);
        vec2 drift = vec2(elapsed * .000008,0.);
        vec2 uv = d.xz / (max(h,.017) + .057) * .192 + vec2(.417,.347) + drift;
        vec2 cirrus = d.xz / (h + .084) * vec2(.135,.55);
        float veil = smoothstep(.50,.74,texture2D(cloudMap, cirrus + .516).x)
                     * smoothstep(.02,.18,h) * .19;
        sky = mix(sky,vec3(.9,.89,.85),veil);
        float cloud = billows(uv);
        float lum = billows(uv - towardsSun.xz * .019);
        float cover = smoothstep(.51,.604,cloud) * smoothstep(.009,.15,h);
        float sunlight = clamp(.44 + (cloud-lum)*6.5 + .31*smoothstep(.53,.69,cloud),0.,1.);
        vec3 shade = mix(vec3(.40,.492,.543),vec3(.68,.647,.566),pow(max(0.,mu),4.));
        vec3 cloudColor = mix(shade,vec3(1.08,1.035,.908),sunlight);
        sky = mix(sky,cloudColor,cover * .94);
        sky += (vec3(1.9,1.52,.93)*exp(-1450. * (1.-mu)) +
                vec3(4.,3.4,2.4)*smoothstep(.999925,.999981,mu))*(1.-cover*.88);
        gl_FragColor = vec4(sky,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const sky = attach(new T.SphereGeometry(1200, 36, 20), skyMaterial);
  sky.name = 'Atlantic summer sky'; sky.renderOrder = -10000; sky.frustumCulled = false;

  // A single aerial atlas keeps adjacent parcel boundaries, shadows and lanes coherent.
  const atlas = canvas(3072);
  const cx = atlas.getContext('2d');
  const px = atlas.width / extent;
  cx.setTransform(px, 0, 0, px, atlas.width / 2, atlas.height / 2);
  cx.fillStyle = '#939c64';
  cx.fillRect(-extent/2,-extent/2,extent,extent);
  function line(points, col, width, context=cx) {
    context.beginPath();
    for (let i = 0; i < points.length; ++i) {
      const [x,z] = points[i]; i ? context.lineTo(x,z) : context.moveTo(x,z);
    }
    context.lineWidth=width;context.strokeStyle=col;context.stroke();
  }
  function parcelPath(points) {
    cx.beginPath();
    for (let i=0;i<points.length;++i) i ? cx.lineTo(...points[i]) : cx.moveTo(...points[i]);
    cx.closePath();
  }
  const hedgeTrees = [];
  const scrub = [];
  const n = 47, cell = 224;
  const nodes = [];
  for (let j=0;j<=n;j++) {
    const row = [];
    for (let i=0;i<=n;i++) {
      const a = (i-n/2)*cell, b=(j-n/2)*cell;
      row.push([a+71*Math.sin(b/1500+a/1900)+45*Math.sin(b/680)+between(-42,42),
                b+76*Math.sin(a/1350-b/1900)+44*Math.sin(a/550)+between(-45,45)]);
    }
    nodes.push(row);
  }
  const clearOfAirfield = (x,z) => !(x > -105 && x < 150 && z > -530 && z < 310) && clearsDistrict(x,z,5);
  const clearOfWater = (x,z) => Math.abs(x-riverX(z))>riverWidth(z)+8;
  function hedge(a,b) {
    if (random() < .11) return;
    line([a,b], '#66794c', between(4.2,7.8));
    line([a,b], '#718354', 2.5);
    const dist = Math.hypot(a[0]-b[0], a[1]-b[1]);
    const all = Math.floor(dist/between(24,57));
    if (Math.min(Math.abs(a[0]),Math.abs(b[0]))>4450 || Math.abs(a[1])>4470) return;
    for (let i=0;i<all;++i) {
      const t=(i+random())/all, x=a[0]+(b[0]-a[0])*t+between(-3,3), z=a[1]+(b[1]-a[1])*t+between(-3,3);
      if(!clearOfAirfield(x,z) || !clearOfWater(x,z)) continue;
      if (random()<.34) hedgeTrees.push([x,z,between(5,13)]);
      else if(Math.hypot(x,z)<1800) scrub.push([x,z,between(1.4,3.1)]);
    }
  }
  const edges=[];
  for (let j=0;j<n;j++) for (let i=0;i<n;i++) {
    const p=[nodes[j][i],nodes[j][i+1],nodes[j+1][i+1],nodes[j+1][i]];
    parcelPath(p);
    cx.fillStyle = palette[Math.floor(random()*palette.length)]; cx.fill();
    const a=p[0], b=p[2];
    const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2;
    cx.save(); cx.clip();
    cx.translate(mx,mz);
    const edge = random()>.5 ? p[1] : p[3];
    cx.rotate(Math.atan2(edge[1]-a[1],edge[0]-a[0])+between(-.08,.08));
    const spacing=between(6.5,13), variation=random();
    cx.lineWidth=variation>.76 ? 2.6 : 1.2;
    cx.strokeStyle = variation>.5 ? 'rgba(247,229,158,.20)' : 'rgba(52,68,30,.18)';
    cx.beginPath();
    for(let o=-355;o<=355;o+=spacing) {
      cx.moveTo(-335,o);cx.bezierCurveTo(-120,o+2,125,o-1,335,o+1);
    }
    cx.stroke();
    if (variation>.70) {
      cx.strokeStyle='rgba(67,73,35,.26)'; cx.lineWidth=1.7;cx.beginPath();
      for(let o=-356;o<355;o+=spacing*5) {
        cx.moveTo(-335,o+3);cx.lineTo(335,o+3);cx.moveTo(-335,o+5);cx.lineTo(335,o+5);
      }
      cx.stroke();
    }
    cx.restore();
    edges.push([p[0],p[1]], [p[0],p[3]]);
  }
  for(const [a,b] of edges) hedge(a,b);

  // Copse and orchard footprints read even at circuit altitude.
  const woodland = [];
  for(let i=0;i<145;i++) {
    const x=between(-4300,4300),z=between(-4300,4300),a=between(32,112),b=between(24,78);
    if (Math.hypot(x,z)<340 || !clearOfAirfield(x,z) || !clearOfWater(x,z)) continue;
    const pp=[]; const rot=between(0,Math.PI);
    for(let k=0;k<30;k++) {
      const ang=k/30*Math.PI*2, rr=between(.78,1.18);
      const dx=a*rr*Math.cos(ang), dz=b*rr*Math.sin(ang);
      pp.push([x+dx*Math.cos(rot)-dz*Math.sin(rot),z+dx*Math.sin(rot)+dz*Math.cos(rot)]);
    }
    parcelPath(pp);cx.fillStyle='#63794d';cx.fill();
    const count=Math.min(130,Math.ceil(a*b/61));
    for(let k=0;k<count;k++) {
      const theta=between(0,Math.PI*2),d=Math.sqrt(random()),dx=Math.cos(theta)*d*a,dz=Math.sin(theta)*d*b;
      const xx=x+dx*Math.cos(rot)-dz*Math.sin(rot),zz=z+dx*Math.sin(rot)+dz*Math.cos(rot);
      if(clearOfAirfield(xx,zz)&&clearOfWater(xx,zz)) woodland.push([xx,zz,between(6,14)]);
    }
  }
  const mainRoad = z => -445+237*Math.sin(z/1350+.3)+99*Math.sin(z/487)+39*Math.sin(z/208);
  function ribbon(fn, start, end, stride, edgeColor, edgeWidth, coreColor, coreWidth) {
    const p=[]; for(let q=start;q<=end;q+=stride) p.push(fn(q));
    line(p,edgeColor,edgeWidth);line(p,coreColor,coreWidth);return p;
  }
  ribbon(z=>[mainRoad(z),z],-4900,4900,16,'#879064',9,'#c5b899',5.7);
  ribbon(x=>[x,-720+95*Math.sin(x/460)+52*Math.sin(x/237)],-4900,4900,18,'#889368',8.3,'#c8ba96',4.6);
  ribbon(x=>[x,1000+170*Math.sin(x/610)+65*Math.sin(x/312)],-4900,4900,18,'#899668',8,'#c2b48c',4.0);
  ribbon(z=>[riverX(z),z],-4980,4980,12,'#728562',54,'#748e8f',39);

  // Paddocks around the landing ground and the mown strip.
  const meadow=[[-113,-486],[-73,-528],[104,-497],[161,-345],[164,193],[133,271],[43,292],[-110,240],[-135,-131]];
  parcelPath(meadow);cx.fillStyle='#939e64';cx.fill();
  cx.save();parcelPath(meadow);cx.clip();
  for(let k=-160;k<175;k+=10) {
    cx.fillStyle=k%20===0?'rgba(232,230,160,.10)':'rgba(88,104,51,.07)';
    cx.fillRect(k,-540,10,850);
  }
  cx.restore();
  const strip=[[-22,-461],[-17,-477],[17,-477],[23,-462],[23,205],[18,222],[-17,222],[-23,207]];
  parcelPath(strip);cx.fillStyle='#91a063';cx.fill();
  for(let z=-449;z<204;z+=19) {
    cx.fillStyle='rgba(207,215,144,.13)'; cx.fillRect(-22,z,44,8);
  }
  line([[-18,-449],[-18,203]],'rgba(132,143,82,.7)',1.2);
  line([[18,-449],[18,202]],'rgba(132,143,82,.7)',1.2);
  line([[53,30],[60,107],[57,150],[66,194],[99,241]],'#aaa785',4.7);
  paintDistrictLanes(cx);
  const groundTexture = colorTexture(atlas, true);

  // A tiling meter-scale grass/soil texture separates airfield detail from the aerial atlas.
  const detailCanvas=canvas(256),dc=detailCanvas.getContext('2d');
  dc.fillStyle='#b4b5a8';dc.fillRect(0,0,256,256);
  for(let k=0;k<22000;k++) {
    const x=between(0,256), y=between(0,256);
    dc.fillStyle=random()<.46?'rgba(246,246,222,.31)':'rgba(65,69,53,.30)';
    dc.fillRect(x,y,between(.45,1.62),between(.8,3.8));
  }
  const grassTexture=colorTexture(detailCanvas,true);
  function axis(t) {
    const sign=Math.sign(t), a=Math.abs(t);
    return sign*(a<.59 ? a/.59*3600 : 3600+12400*Math.pow((a-.59)/.41,1.65));
  }
  const grid=268, verts=[],uvs=[],idx=[];
  for(let j=0;j<=grid;j++) for(let i=0;i<=grid;i++) {
    const x=axis(i/grid*2-1),z=axis(j/grid*2-1);
    verts.push(x,heightAt(x,z),z);uvs.push(x/extent+.5,z/extent+.5);
    if(i<grid&&j<grid) {
      const p=j*(grid+1)+i;idx.push(p,p+grid+1,p+1,p+1,p+grid+1,p+grid+2);
    }
  }
  const meshGeo=(v,ix,uv)=> {
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(v,3));
    if(uv)g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    g.setIndex(ix);g.computeVertexNormals();return g;
  };
  const groundMaterial=lambert('#ffffff',{map:groundTexture});
  groundMaterial.onBeforeCompile=shader=>{
    shader.uniforms.grassDetail={value:grassTexture};
    shader.uniforms.landNoise={value:noise};
    shader.vertexShader='varying vec2 terrainXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n terrainXZ = position.xz;');
    shader.fragmentShader='varying vec2 terrainXZ; uniform sampler2D grassDetail; uniform sampler2D landNoise;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float closeDetail = texture2D(grassDetail,terrainXZ/4.3).r;
      float fieldGrain = texture2D(grassDetail,terrainXZ/64.).r;
      float blotch = texture2D(landNoise,terrainXZ/177. + .731).r - .48;
      float furrows = texture2D(landNoise,terrainXZ/vec2(26.,106.) + .31).r - .48;
      float broad = texture2D(landNoise,terrainXZ/1570. + .82).r;
      float shade = smoothstep(.52,.69,broad);
      diffuseColor.rgb *= .86 + closeDetail * .31 + fieldGrain * .13 + blotch*.33 + furrows*.17;
      diffuseColor.rgb *= mix(vec3(1.03,1.025,1.0),vec3(.78,.82,.87),shade);
      float strip = (1.0-smoothstep(21.5,25.,abs(terrainXZ.x))) *
                     smoothstep(-476.,-451.,terrainXZ.y) * (1.-smoothstep(201.,224.,terrainXZ.y));
      float mow = sin(terrainXZ.x*1.31 + .10*sin(terrainXZ.y*.07));
      diffuseColor.rgb *= 1. + strip*(mow*.026 + blotch*.20);
      float tread = exp(-.38*pow(abs(abs(terrainXZ.x+.28*sin(terrainXZ.y*.045))-1.05),2.));
      diffuseColor.rgb += strip*tread*(.008+.009*blotch)*vec3(1.,.61,.19);`);
  };
  const ground=attach(meshGeo(verts,idx,uvs),groundMaterial);
  ground.name='Fields, lanes and landing ground';ground.receiveShadow=true;

  // Painted leaf clusters retain individual boughs at the distance of a low circuit.
  function treePicture(kind) {
    const pic=document.createElement('canvas');
    pic.width=384;pic.height=448;
    const c=pic.getContext('2d');
    const slender=kind===2, crownWidth=slender?75:(kind===1?126:140);
    const crownTop=13+(kind===1?16:0);
    const center=192, top=crownTop+31, groundY=443;
    const trunk=between(187,197), stemTop=slender?107:178;
    const groups=[];
    const disks=[];
    function branch(x,y,x2,y2,width) {
      c.beginPath();c.moveTo(x,y);
      c.quadraticCurveTo((x+x2)/2+4,(y+y2)/2,x2,y2);
      c.strokeStyle='#575343';c.lineWidth=width;c.lineCap='round';c.stroke();
      c.beginPath();c.moveTo(x-width*.20,y);
      c.lineTo(x2-width*.16,y2);c.lineWidth=Math.max(1,width*.25);c.strokeStyle='#847459';c.stroke();
    }
    branch(trunk,groundY,center-2,stemTop,slender?10:13);
    const count=slender?51:66;
    for(let i=0;i<count;i++) {
      const fy=random(), y=top+fy*(slender?266:225);
      const width=crownWidth*Math.pow(Math.sin(Math.PI*Math.min(.995,fy*.91+.05)),slender?.72:.54);
      const x=center+between(-width,width);
      const size=between(17,35)*(slender?.80:1);
      groups.push([x,y,size]);
      if(i%3===0) {
        const by=330+(y-175)*.29;
        branch(center+(y-170)*.025,by,x,y+4,between(1.5,4.3));
      }
    }
    groups.sort((a,b)=>a[1]-b[1]);
    const base=[
      [53,73,44],[61,80,42],[65,82,52],[49,71,49]
    ][kind];
    function paint(r,g,b) {return 'rgb('+Math.round(r)+','+Math.round(g)+','+Math.round(b)+')';}
    for(const [x,y,sz] of groups) {
      for(let k=0;k<30;k++) {
        const theta=between(0,Math.PI*2), rad=Math.sqrt(random())*sz;
        const dx=Math.cos(theta)*rad,dy=Math.sin(theta)*rad*.83;
        const value=between(-12,14) - 8*dx/sz - 10*dy/sz - (y-170)*.034;
        disks.push([x+dx,y+dy,between(2.2,8.5),value,sz]);
      }
    }
    for(const [x,y,r,v] of disks) {
      c.fillStyle=paint(base[0]+v*.95,base[1]+v*.92,base[2]+v*.58);
      c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
    }
    for(const [x,y,sz] of groups) {
      const warm=between(-8,16);
      for(let k=0;k<60;k++) {
        const theta=between(0,Math.PI*2),rad=Math.sqrt(random())*sz*.88;
        const dx=Math.cos(theta)*rad,dy=Math.sin(theta)*rad*.82;
        if(dx+dy>sz*.27)continue;
        const v=between(7,34)+warm-7*(dx+dy)/sz;
        c.fillStyle=paint(base[0]+v*1.15,base[1]+v,base[2]+v*.57);
        c.beginPath();c.ellipse(x+dx,y+dy,between(1.1,4.4),between(1,3.6),0,0,Math.PI*2);c.fill();
      }
    }
    const tex=colorTexture(pic);
    tex.flipY=true;tex.anisotropy=2;
    return tex;
  }
  const trees=[...hedgeTrees,...woodland,...districtTrees];
  // Landmark oaks, especially the hedgerow behind the aerodrome.
  for(let i=0;i<42;i++) trees.push([between(142,174),-478+i*18+between(-5,5),between(5.9,11)]);
  for(let i=0;i<31;i++) trees.push([between(-128,-107),-452+i*23+between(-5,5),between(6,11.6)]);
  // Only sporadic trees line the river, leaving visible stretches of water.
  for(let z=-4510;z<4500;z+=between(28,82)) {
    const side=random()>.5?1:-1;
    trees.push([riverX(z)+side*(riverWidth(z)+between(5,15)),z,between(5,13)]);
  }
  const batches=[[],[],[],[]];
  function addTree(item, shrub=false) {
    const [x,z,h]=item;
    const y=heightAt(x,z);
    const kind=shrub?1:Math.floor(random()*4);
    const w=h*(kind===2?.72:between(.98,1.22));
    batches[kind].push([x,y,z,w,h,between(.85,1.12)]);
    if(h>3) {
      cx.save();cx.translate(x+h*.67,z+h*.66);cx.rotate(.77);
      cx.fillStyle='rgba(43,53,41,.24)';
      cx.beginPath();cx.ellipse(0,0,h*.88,h*.32,0,0,Math.PI*2);cx.fill();
      cx.fillStyle='rgba(49,59,41,.11)';
      cx.beginPath();cx.ellipse(0,0,h*1.03,h*.41,0,0,Math.PI*2);cx.fill();cx.restore();
    }
  }
  for(const t of trees)addTree(t);
  for(const t of scrub)addTree(t,true);
  const dummy=new T.Object3D();
  const treePlane=new T.PlaneGeometry(1,1);
  treePlane.translate(0,.5,0);
  for(let kind=0;kind<batches.length;kind++) {
    const m=new T.MeshBasicMaterial({map:treePicture(kind),alphaTest:.42,side:T.DoubleSide,transparent:false});
    m.onBeforeCompile=s=>{
      s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`
        vec3 root=instanceMatrix[3].xyz;
        vec3 eye=normalize(cameraPosition-root);
        vec2 horizontal=eye.xz;
        float dw=max(.0001,length(horizontal));
        vec3 across=vec3(horizontal.y/dw,0.,-horizontal.x/dw);
        vec3 slant=vec3(-horizontal.x/dw,0.,-horizontal.y/dw)*min(.65,max(0.,eye.y)*.65);
        vec3 up=normalize(vec3(0.,1.,0.)+slant);
        vec3 vv=root+across*position.x*instanceMatrix[0].x+up*position.y*instanceMatrix[1].y;
        vec4 mvPosition=viewMatrix*vec4(vv,1.);
        gl_Position=projectionMatrix*mvPosition;`);
    };
    const entries=batches[kind], instances=new T.InstancedMesh(treePlane,m,entries.length);
    entries.forEach(([x,y,z,w,h,l],i)=>{
      dummy.position.set(x,y-.07,z);dummy.scale.set(w,h,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();
      instances.setMatrixAt(i,dummy.matrix);
      instances.setColorAt(i,new T.Color(l,l*(1+(i%5)*.008),l*(.91+(i%6)*.02)));
    });
    instances.name='Hedgerows and copses';instances.computeBoundingSphere();
    world.add(instances);
  }
  groundTexture.needsUpdate=true;

  // Raised thorn hedges give the field boundaries volume on a low approach.
  const hedgeV=[], hedgeF=[], hedgeC=[];
  const hedgetone=color('#697e50'), hedlit=color('#89945b');
  const hedgeLines=edges.filter(([a,b],i)=>i%9!==0&&Math.hypot((a[0]+b[0])*.5,(a[1]+b[1])*.5)<1980);
  hedgeLines.push([[-125,-435],[-113,234]],[[150,-465],[158,202]]);
  for(const [a,b] of hedgeLines) {
    const dx=b[0]-a[0],dz=b[1]-a[1],dist=Math.hypot(dx,dz);
    const steps=Math.max(2,Math.ceil(dist/12)),nx=-dz/dist,nz=dx/dist;
    const isFieldEdge=a[0]===-125||a[0]===150;
    let last=-1;
    for(let i=0;i<=steps;i++) {
      const t=i/steps,x=a[0]+t*dx,z=a[1]+t*dz;
      if((!isFieldEdge&&!clearOfAirfield(x,z))||!clearOfWater(x,z)||Math.abs(x-mainRoad(z))<8||
         Math.abs(z+720-95*Math.sin(x/460)-52*Math.sin(x/237))<7||
         Math.abs(z-1000-170*Math.sin(x/610)-65*Math.sin(x/312))<7) {last=-1;continue;}
      const y=heightAt(x,z), h=between(1.18,2.3)*(isFieldEdge?1.32:1), width=between(1.5,2.32);
      const k=hedgeV.length/3;
      for(const [w,up,c] of [[-width,-.14,hedgetone],[-width*.6,h*.79,hedgetone],[.06,h,hedlit],[width*.62,h*.75,hedgetone],[width,-.14,hedgetone]]) {
        hedgeV.push(x+nx*w,y+up,z+nz*w);
        const v=between(.85,1.11);
        hedgeC.push(c.r*v,c.g*v,c.b*v);
      }
      if(last>=0)for(let j=0;j<4;j++)hedgeF.push(last+j,k+j,last+j+1,last+j+1,k+j,k+j+1);
      last=k;
    }
  }
  const hedgeGeo=meshGeo(hedgeV,hedgeF);
  hedgeGeo.setAttribute('color',new T.Float32BufferAttribute(hedgeC,3));
  const hedgeMesh=attach(hedgeGeo,lambert('#ffffff',{vertexColors:true,side:T.DoubleSide}));
  hedgeMesh.name='Thorn field boundaries';

  // The river follows its own level bed, cut into the analytical terrain.
  const waterVerts=[], waterUV=[], waterFaces=[];
  for(let z=-4750,k=0;z<=4750;z+=10,k++) {
    const wx=riverX(z),ww=riverWidth(z);
    for(const side of [-1,1]) {
      waterVerts.push(wx+side*ww,-2.15,z);waterUV.push(side*.5+.5,z/70);
    }
    if(k) {const q=2*k;waterFaces.push(q-2,q,q-1,q-1,q,q+1);}
  }
  const waterMat=new T.MeshBasicMaterial({color:'#859fa1',side:T.DoubleSide});
  waterMat.onBeforeCompile=s=>{
    s.uniforms.waterGrain={value:noise};s.uniforms.solarVector={value:skyDirection};
    s.vertexShader='varying vec3 riverP;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n riverP=position;');
    s.fragmentShader='varying vec3 riverP; uniform sampler2D waterGrain; uniform vec3 solarVector;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 V=normalize(cameraPosition-riverP);
      float n=texture2D(waterGrain,riverP.xz*vec2(.045,.215)).r;
      float glint=pow(max(dot(reflect(-solarVector,vec3(0.,1.,0.)),V),0.),22.);
      diffuseColor.rgb*=.86+.18*n;
      diffuseColor.rgb+=vec3(.46,.34,.17)*glint*smoothstep(.42,.62,n);`);
  };
  const river=attach(meshGeo(waterVerts,waterFaces,waterUV),waterMat);river.name='River and shallow valley';

  // Repeated shapes are submitted in material/geometry batches.
  const cube=new T.BoxGeometry(1,1,1);
  const cylinder=new T.CylinderGeometry(1,1,1,10);
  const batches3D=new Map();
  function instance(geometry, material, p, size, rot=[0,0,0], tint=null, cast=false) {
    const key=geometry.uuid+material.uuid+cast;
    if(!batches3D.has(key))batches3D.set(key,{geometry,material,cast,items:[]});
    dummy.position.set(...p);dummy.scale.set(...size);
    if(rot.isQuaternion)dummy.quaternion.copy(rot);else dummy.rotation.set(...rot);
    dummy.updateMatrix();
    batches3D.get(key).items.push([dummy.matrix.clone(),tint]);
  }
  const yAxis=new T.Vector3(0,1,0);
  function beam(a,b,width,material,depth=width,cast=true) {
    const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va);
    const q=new T.Quaternion().setFromUnitVectors(yAxis,d.clone().normalize());
    instance(cube,material,va.add(vb).multiplyScalar(.5).toArray(),[width,d.length(),depth],q,null,cast);
  }
  const timber=lambert('#786247'),tar=lambert('#454941'),whitewash=lambert('#b9af8b');
  const lead=lambert('#697075'),iron=lambert('#777972'),black=lambert('#343c37'),thatch=lambert('#927b53');
  const brick=lambert('#9d795c'),roofBrick=lambert('#8e6658'),glass=lambert('#556463'),cream=lambert('#c6bda2');
  const roofSteel=lambert('#848483'), darkTimber=lambert('#554e3d');
  const buildings = [];
  function shed(x,z,width,depth,eaves,rise,wall,roof,near=false) {
    const y=heightAt(x,z);
    buildings.push([x,z,width*.5,depth*.5,y,eaves,rise]);
    instance(cube,wall,[x,y+eaves/2,z],[width,eaves,depth],[0,0,0],null,near);
    // Roof ridge along world X. End walls and sloped surfaces form a true pitched roof.
    const gableVerts=[-.5,0,-.5,-.5,0,.5,-.5,1,0, .5,0,-.5,.5,1,0,.5,0,.5];
    if(!shed.gable)shed.gable=meshGeo(gableVerts,[0,1,2,3,4,5]);
    instance(shed.gable,wall,[x,y+eaves,z],[width,rise,depth],[0,0,0],null,near);
    const slope=Math.atan2(rise,depth*.5),length=Math.hypot(depth/2,rise)+.48;
    for(const side of [-1,1]) {
      instance(cube,roof,[x,y+eaves+rise/2+.08,z+side*depth*.25],[width+.6,.22,length],[side*slope,0,0],null,near);
    }
    if(near) {
      // Sliding doors open toward the grass; black panels read as the deep unlit interior.
      const front=x-width/2-.07;
      instance(cube,black,[front,y+eaves*.48,z],[.14,eaves*.96,depth*.77]);
      const openDoorDepth=depth*.18;
      for(const s of [-1,1]) {
        const dz=z+s*depth*.377;
        instance(cube,tar,[front-.09,y+eaves*.47,dz],[.18,eaves*.94,openDoorDepth],[0,0,0],null,true);
        for(const t of [-1,1])
          beam([front-.2,y+.2,dz+t*openDoorDepth*.43],[front-.2,y+eaves*.88,dz-t*openDoorDepth*.43],.12,timber);
        beam([front-.12,y+.05,z+s*depth*.39],[front-.12,y+eaves,z+s*depth*.39],.19,timber);
      }
      beam([front-.14,y+eaves,z-depth*.49],[front-.14,y+eaves+rise,z],.19,timber);
      beam([front-.14,y+eaves,z+depth*.49],[front-.14,y+eaves+rise,z],.19,timber);
      beam([front-.14,y+eaves,z-depth*.49],[front-.14,y+eaves,z+depth*.49],.17,timber);
      for(let p=-depth*.43;p<=depth*.43;p+=1.42) {
        const span=rise*(1-Math.abs(p)/(depth*.5));
        if(span>0.03)beam([front-.06,y+eaves,z+p],[front-.06,y+eaves+span,z+p],.09,timber);
      }
      for(let a=-width*.47;a<width*.48;a+=.88) {
        for(const s of [-1,1])beam([x+a,y+eaves+rise+.17,z],[x+a,y+eaves+.16,z+s*depth*.5],.055,lead,.07,false);
      }
      for(let a=-width*.46;a<width*.5;a+=2.35) {
        instance(cube,darkTimber,[x+a,y+eaves*.49,z+depth*.5+.04],[.13,eaves,.10]);
        instance(cube,glass,[x+a+.6,y+eaves*.65,z+depth*.5+.065],[.77,.85,.095]);
      }
    }
  }
  shed(77,44,24,25,4.65,3.2,tar,roofSteel,true);
  shed(83,83,21,23,4.2,3.05,darkTimber,iron,true);
  shed(113,108,12,6,2.5,1.65,cream,roofBrick);
  shed(109,8,10,5.8,2.5,1.55,brick,lead);
  // Low white airfield boundary markers. The runway remains undisturbed grass.
  for(let z=-445;z<207;z+=44)for(const s of [-1,1]) {
    instance(cube,cream,[s*23.7,.18,z],[.43,.36,1.35],[0,s*.06,0],null,true);
    instance(cube,whitewash,[s*23.7,.38,z],[.47,.05,1.4]);
  }
  // Narrow masonry crossings on the two lanes through the valley.
  for(const lane of [x=>-720+95*Math.sin(x/460)+52*Math.sin(x/237),
                     x=>1000+170*Math.sin(x/610)+65*Math.sin(x/312)]) {
    let zz=lane(1520);
    for(let k=0;k<8;k++)zz=lane(riverX(zz));
    const bx=riverX(zz), bz=zz;
    const angle=Math.atan2(lane(bx+4)-lane(bx-4),8);
    const dx=Math.cos(angle),dz=Math.sin(angle), half=riverWidth(bz)*1.55;
    const level=Math.max(1.1,heightAt(bx-half*dx,bz-half*dz),heightAt(bx+half*dx,bz+half*dz));
    instance(cube,whitewash,[bx,level,bz],[half*2,.68,5.9],[0,-angle,0]);
    for(const w of [-2.8,2.8]) {
      instance(cube,whitewash,[bx-dz*w,level+.62,bz+dx*w],[half*2,.87,.40],[0,-angle,0]);
    }
    for(const u of [-.85,0,.85]) {
      instance(cube,whitewash,[bx+u*half*dx,(level-2.8)*.5,bz+u*half*dz],[1.85,level+2.8,5.8],[0,-angle,0]);
    }
  }
  const farmSites=[];
  for(let k=0;k<66;k++) {
    const x=between(-4070,4070),z=between(-4060,4060);
    if(Math.hypot(x,z)<360||!clearOfWater(x,z))continue;
    farmSites.push([x,z]);
  }
  // The small parish near the approach includes a flint church tower.
  const vx=-385,vz=-790;
  for(let k=0;k<17;k++)farmSites.push([vx+between(-128,79),vz+between(-80,90)]);
  for(const [x,z] of farmSites) {
    if(!clearsDistrict(x,z,33))continue;
    const w=between(7.2,13.5),d=between(4.6,7.3),e=between(2.6,4.3),r=between(1.65,3.1);
    const wall=random()<.45?brick:whitewash, roof=random()<.36?thatch:roofBrick;
    shed(x,z,w,d,e,r,wall,roof);
    const y=heightAt(x,z);
    instance(cube,brick,[x+w*.32,y+e+r*.85,z+.2],[.78,2,.83]);
    for(const a of [-.29,.23]) {
      instance(cube,glass,[x+w*a,y+e*.58,z+d*.5+.02],[.82,.95,.08]);
    }
    if(random()<.45)shed(x+15,z+11,between(7,14),between(4,8),3.45,2.25,tar,lead);
  }
  const churchx=vx+61,churchz=vz-20,chY=heightAt(churchx,churchz);
  shed(churchx,churchz,18,7.6,5.1,3.2,whitewash,lead);
  instance(cube,whitewash,[churchx-8.3,chY+6.8,churchz],[5.7,13.6,5.7]);
  for(const dx of [-2.48,2.48])for(const dz of [-2.48,2.48])
    instance(cube,whitewash,[churchx-8.3+dx,chY+13.8,churchz+dz],[.68,1.1,.68]);
  for(const dz of [-2.88,2.88])for(const dx of [-.74,.74])
    instance(cube,black,[churchx-8.3+dx,chY+10.4,churchz+dz],[.62,1.95,.10]);
  // Sparse posts and rails, along two perimeter segments away from the landing strip.
  for(const [a,b] of [[[132,-62],[132,205]],[[132,204],[53,261]],[[-103,236],[-127,44]]]) {
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.ceil(length/4.5);
    for(let k=0;k<=count;k++) {
      const f=k/count,x=a[0]+(b[0]-a[0])*f,z=a[1]+(b[1]-a[1])*f,y=heightAt(x,z);
      instance(cube,timber,[x,y+.57,z],[.12,1.15,.12]);
      if(k<count) {
        const x2=x+(b[0]-a[0])/count,z2=z+(b[1]-a[1])/count;
        beam([x,y+.76,z],[x2,heightAt(x2,z2)+.76,z2],.085,timber,.085,false);
      }
    }
  }
  // The fabric sleeve is separate so it can respond gently to the field breeze.
  const windsockX=32, windsockZ=103;
  const mastY=heightAt(windsockX,windsockZ);
  instance(cylinder,iron,[windsockX,mastY+2.8,windsockZ],[.076,5.6,.076],[0,0,0],null,true);
  instance(cylinder,cream,[windsockX,mastY+.78,windsockZ],[.10,1.56,.10]);
  const sleeve=new T.Group();
  sleeve.name='Windsock';sleeve.position.set(windsockX,mastY+5.52,windsockZ);
  world.add(sleeve);
  const fabricV=[], fabricF=[], fabricC=[];
  const stops=6, sides=20;
  const linen=color('#e9debd'),vermilion=color('#b95636');
  for(let k=0;k<stops;k++) {
    for(let j=0;j<=sides;j++)for(const end of [0,1]) {
      const f=(k+end)/stops, theta=Math.PI*2*j/sides;
      const radius=.38*(1-.71*f);
      fabricV.push(.19+2.86*f,-.58*f*f+radius*Math.sin(theta),radius*Math.cos(theta));
      const tint=k%2===0?vermilion:linen;fabricC.push(tint.r,tint.g,tint.b);
    }
    for(let j=0;j<sides;j++) {
      const p=(k*(sides+1)+j)*2;
      fabricF.push(p,p+1,p+2,p+1,p+3,p+2);
    }
  }
  const sleeveGeo=meshGeo(fabricV,fabricF);
  sleeveGeo.setAttribute('color',new T.Float32BufferAttribute(fabricC,3));
  const sock=attach(sleeveGeo,lambert('#ffffff',{vertexColors:true,side:T.DoubleSide}),sleeve);
  sock.castShadow=true;
  // Thin leaf cards are only distributed near the pilot, where they give grass scale and parallax.
  const bladeVerts=[],bladeFaces=[],bladeColors=[];
  for(let i=0;i<6;i++) {
    const a=between(0,6.28),x=between(-.075,.075),z=between(-.075,.075);
    const w=between(.012,.021),h=between(.10,.26), dx=w*Math.cos(a),dz=w*Math.sin(a);
    const p=bladeVerts.length/3;
    bladeVerts.push(x-dx,0,z-dz,x+dx,0,z+dz,x+dx*2.4,h,z+.028);
    bladeFaces.push(p,p+2,p+1);
    bladeColors.push(.73,.78,.57,.73,.78,.57,1.11,1.12,.88);
  }
  const grassGeo=meshGeo(bladeVerts,bladeFaces);
  grassGeo.setAttribute('color',new T.Float32BufferAttribute(bladeColors,3));
  const grassMat=new T.MeshBasicMaterial({color:'#657741',vertexColors:true,side:T.DoubleSide});
  for(let i=0;i<10500;i++) {
    const x=between(-93,118),z=between(-454,225);
    if(x>49 && x<103 && z>-2 && z<112)continue;
    const groomed=Math.abs(x)<23;
    let h=groomed?between(.16,.41):between(.65,1.3);
    if(groomed&&random()<.68)continue;
    if(i%23===0)h*=1.21;
    instance(grassGeo,grassMat,[x,heightAt(x,z)+.006,z],[between(.9,1.55),h,between(.9,1.55)],[0,between(0,6.28),0]);
  }
  for(const {geometry,material,cast,items} of batches3D.values()) {
    const mesh=new T.InstancedMesh(geometry,material,items.length);
    items.forEach(([m,c],i)=>{mesh.setMatrixAt(i,m);if(c)mesh.setColorAt(i,c);});
    mesh.castShadow=cast;mesh.receiveShadow=cast;mesh.computeBoundingSphere();world.add(mesh);
  }
  // Grid queries avoid scanning thousands of trees on every simulation tick.
  const collisionCells=new Map(),collisionStep=80;
  function insertObstacle(x,z,r,record) {
    for(let j=Math.floor((z-r)/collisionStep);j<=Math.floor((z+r)/collisionStep);j++)
      for(let i=Math.floor((x-r)/collisionStep);i<=Math.floor((x+r)/collisionStep);i++) {
        const key=i+','+j;
        if(!collisionCells.has(key))collisionCells.set(key,[]);
        collisionCells.get(key).push(record);
      }
  }
  for(const [x,z,h] of trees)insertObstacle(x,z,h*.38,[0,x,z,h*.38,heightAt(x,z),h]);
  buildings.push([churchx-8.3,churchz,2.9,2.9,chY,13.6,.5]);
  for(const building of buildings)insertObstacle(building[0],building[1],Math.hypot(building[2],building[3])+1,[1,...building]);
  const district=makeTowerDistrict(T,world);
  function collisionAt(x,y,z,previous,attitude) {
    if(district.hits(x,y,z,previous,attitude))return true;
    if(Math.abs(z)<4750&&Math.abs(x-riverX(z))<riverWidth(z)&&y<-1.85)return true;
    const records=collisionCells.get(Math.floor(x/collisionStep)+','+Math.floor(z/collisionStep));
    if(!records)return false;
    for(const entry of records) {
      const dx=x-entry[1],dz=z-entry[2];
      if(entry[0]===0) {
        const [, , ,radius,base,h]=entry;
        const above=y-base;
        if(above<h*.94 && dx*dx+dz*dz<radius*radius*(above<h*.22?.25:1.0))return true;
      } else {
        const [, , , halfX,halfZ,base,eaves,rise]=entry;
        if(Math.abs(dx)<halfX+.45 && Math.abs(dz)<halfZ+.45 && y<base+eaves+rise*(1-Math.abs(dz)/halfZ))return true;
      }
    }
    return false;
  }
  let time=0;
  function update(dt, planePosition, cameraPosition) {
    time+=Math.min(.16,Math.max(0,dt||0));
    sky.position.copy(cameraPosition);
    skyMaterial.uniforms.elapsed.value=time;
    sleeve.rotation.y=.62+Math.sin(time*.58)*.072+Math.sin(time*1.03)*.027;
    sleeve.rotation.z=.035*Math.sin(time*1.12);
    sun.target.position.copy(planePosition);
    sun.position.copy(planePosition).addScaledVector(skyDirection,99);
    sun.target.updateMatrixWorld();
  }
  update(0,new T.Vector3(0,1,120),new T.Vector3());
  return {heightAt,collisionAt,update, sun, district, runway:{xmin:-23,xmax:23,zmin:-460,zmax:220}};
}
