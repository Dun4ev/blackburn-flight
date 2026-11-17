import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { chapters } from './heritage.js';

const work=path.dirname(fileURLToPath(import.meta.url));
const resourceOnly=process.argv[2]==='--resource-only';
const input=process.argv[resourceOnly?3:2] || path.join(work,'../outputs/Blackburn-Flight.html');
const firstStory=chapters[0];
const magazineUrl='https://www.modelflying.co.uk/blackburn-monoplane/';
const renderFile='assets/history/blackburn-blender.jpg';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const renderHash=digest(await readFile(path.join(work,'..',renderFile)));

async function assertModelArticle(frame,language){
  const label=language==='ru'?'Читать в RCM&E':'Read in RCM&E';
  const link=frame.locator('#historyView a[href="'+magazineUrl+'"]').and(frame.getByRole('link',{name:label,exact:true}));
  await link.waitFor({state:'visible'});
  await link.click({trial:true});
  assert.equal((await link.innerText()).trim(),label);
  const card=link.locator('xpath=ancestor::article[1]');
  const image=card.locator('img');
  await image.scrollIntoViewIfNeeded();
  const encoded=await image.evaluate(async img=>{
    await img.decode();
    if(!img.naturalWidth||!img.naturalHeight||!img.alt.trim())throw Error('Missing image or alternative text');
    return img.currentSrc;
  });
  const prefix='data:image/jpeg;base64,';
  assert.ok(encoded.startsWith(prefix),'The card must embed its own JPEG');
  assert.equal(digest(Buffer.from(encoded.slice(prefix.length),'base64')),renderHash,'Embedded image differs from the Blender render');
  assert.match(await card.locator('figcaption').innerText(),/Blender/);
  assert.equal(await card.locator('[download], a[href*=".pdf" i], iframe, embed, object').count(),0,'The model article should link to the publisher, without a PDF');
  assert.equal(await frame.locator('[href^="data:application/pdf" i], [src^="data:application/pdf" i], [type="application/pdf" i]').count(),0);
  assert.ok(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'History overflows the viewport');
}

async function checkResourceRelease(browser,target){
  const url=/^https?:\/\//.test(target)?new URL(target):pathToFileURL(path.resolve(target));
  const isLocal=url.protocol==='file:';
  for(const [width,height,isMobile] of [[1280,800,false],[390,844,true]]){
    const context=await browser.newContext({viewport:{width,height},isMobile,hasTouch:isMobile,offline:isLocal});
    try{
      const page=await context.newPage();
      const errors=[],requests=[];
      if(isLocal)recordDiagnostics(page,errors,requests);
      await page.goto(url.href,{waitUntil:'domcontentloaded'});
      let frame=page.mainFrame();
      if(url.hostname.endsWith('.itch.io')){
        const game=page.locator('iframe[src*="itch.zone"], iframe[src*="itch.io/embed-upload"]').first();
        if(!await game.count())await page.locator('button.load_iframe_btn').click();
        await game.waitFor({state:'attached'});
        frame=await (await game.elementHandle()).contentFrame();
        assert.ok(frame,'No game frame on the itch.io page');
      }
      await frame.locator('#historyTab').click();
      await frame.locator('#historyView').waitFor({state:'visible'});
      for(const [id,language] of [['langEn','en'],['langRu','ru']]){
        await frame.locator('#'+id).click();
        await assertModelArticle(frame,language);
      }
      assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
      console.log(`PASS RCM&E ${width}×${height} · EN + RU · embedded JPEG ${renderHash.slice(0,12)} · no PDF in card`);
    }finally{await context.close();}
  }
}

async function assertWaypoint(page, number, language='en') {
  const map=page.locator('#trailMapButton');
  await map.waitFor({state:'visible'});
  await page.waitForFunction(({number,language})=>{
    const button=document.querySelector('#trailMapButton');
    const label=(language==='ru'?'Кольцо ':'Ring ')+number;
    return button.querySelector('.mm-number')?.textContent===String(number) &&
      button.getAttribute('aria-label')?.includes(label);
  },{number,language});
}

// Read real pixels: a changed HTML distance label cannot impersonate a retargeted map.
async function mapGraphic(page) {
  const map=page.locator('#trailMapButton canvas');
  await map.waitFor({state:'visible'});
  const graphic=await map.evaluate(canvas=>{
    const {width,height}=canvas.getBoundingClientRect();
    const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const colors=new Set();
    let x=0,y=0,targetPixels=0;
    for(let n=0;n<rgba.length;n+=4){
      const pixel=((((rgba[n]*256)+rgba[n+1])*256+rgba[n+2])*256+rgba[n+3])>>>0;
      if(rgba[n+3]) colors.add(pixel);
      // The selected waypoint has a solid terracotta disc (#9d4328).
      if(Math.abs(rgba[n]-157)<=2 && Math.abs(rgba[n+1]-67)<=2 && Math.abs(rgba[n+2]-40)<=2){
        x+=(n/4)%canvas.width;y+=Math.floor((n/4)/canvas.width);targetPixels++;
      }
    }
    return {width,height,targetPixels,x:x/targetPixels,y:y/targetPixels,detail:colors.size};
  });
  assert.ok(graphic.width>=40 && graphic.height>=28 && graphic.detail>4,
    'Flight HUD should display a painted chart: '+JSON.stringify(graphic));
  assert.ok(graphic.targetPixels>12,'The active waypoint must be drawn on the mini-map');
  return graphic;
}

async function checkStoryCard(page,locale) {
  const card=page.locator('#trailRead');
  await card.waitFor({state:'visible'});
  const story=firstStory[locale];
  const title=card.locator('.trail-story-title'), teaser=card.locator('.trail-teaser');
  await title.waitFor({state:'visible'}); await teaser.waitFor({state:'visible'});
  assert.equal((await title.innerText()).trim(),story.title);
  assert.equal((await teaser.innerText()).trim(),story.teaser);
  const photo=card.locator('img');
  await photo.waitFor({state:'visible'});
  await page.waitForFunction(({id,file})=>{
    const img=document.querySelector('#trailRead img');
    const local=JSON.parse(document.getElementById('historyPhotos').textContent);
    return img.dataset.chapter===id && img.complete && img.naturalWidth>0 &&
      img.currentSrc===local[file] && img.currentSrc.startsWith('data:image/');
  },{id:firstStory.id,file:firstStory.photo.file});
}

async function assertClearFlightLayout(page) {
  const collisions=await page.evaluate(()=>{
    const bounds=(key,selector)=>({key,...document.querySelector(selector).getBoundingClientRect().toJSON()});
    const map=bounds('mini-map','#trailMapButton'), card=bounds('photo card','#trailRead');
    const stick=bounds('touch stick','#stick'), panel=bounds('instruments','.instruments');
    const v=bounds('viewport','#viewport');
    const aim={key:'central flight path',left:v.x+v.width*.46,right:v.x+v.width*.54,
      top:v.y+v.height*.46,bottom:v.y+v.height*.54};
    const pairs=[[map,card],[map,aim],[card,aim],[map,panel],[card,panel],[map,stick],[card,stick]];
    const output=[];
    if(!stick.width||!panel.width)output.push('touch stick or instruments missing');
    for(const item of [map,card,stick,panel]){
      if(item.left<-.5||item.top<-.5||item.right>innerWidth+.5||item.bottom>innerHeight+.5)output.push(item.key+' outside screen');
    }
    for(const [a,b] of pairs){
      if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 &&
        Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)output.push(a.key+' overlaps '+b.key);
    }
    return output;
  });
  assert.deepEqual(collisions,[],JSON.stringify(page.viewportSize())+' layout: '+collisions.join(', '));
}

async function touchFlight(browser, errors, requests) {
  const context=await browser.newContext({viewport:{width:612,height:972},hasTouch:true,offline:true});
  try {
    const page=await context.newPage();
    page.setDefaultTimeout(20000);
    recordDiagnostics(page,errors,requests);
    await page.goto(pathToFileURL(input).href);
    await page.locator('#launch:enabled').click();
    await assertWaypoint(page,1);
    await mapGraphic(page);
    assert.equal(await page.locator('#trailRead').isVisible(),false);
    await page.locator('#trailRead').waitFor({timeout:70000});
    await checkStoryCard(page,'en');
    await assertWaypoint(page,2);
    assert.equal(await page.locator('#trailMap').isVisible(),false);
    await assertClearFlightLayout(page);
    await page.screenshot({path:path.join(work,'test-612-photo-map.png')});
    for(const [width,height] of [[390,844],[844,390]]){
      await page.setViewportSize({width,height});
      await mapGraphic(page);
      await assertClearFlightLayout(page);
    }
    await page.locator('#langRu').click();
    await checkStoryCard(page,'ru');
    await assertWaypoint(page,2,'ru');
    await page.locator('#langEn').click();
    await checkStoryCard(page,'en');
    await page.locator('#langRu').click();
    await checkStoryCard(page,'ru');
    await page.locator('#pause').click();
    await page.locator('#restart').click();
    await page.locator('#trailRead').waitFor({state:'hidden'});
    await assertWaypoint(page,2,'ru');
    assert.equal(await page.locator('#trailMap').isVisible(),false);
  } finally {await context.close();}
}

function recordDiagnostics(page,errors,requests){
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
}

async function runJournal(browser){
  const context=await browser.newContext({viewport:{width:1280,height:800},offline:true});
  const page=await context.newPage(), errors=[], requests=[];
  recordDiagnostics(page,errors,requests);
  page.setDefaultTimeout(20000);
  await page.goto(pathToFileURL(input).href);
  await page.locator('#launch:enabled').waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.equal(await page.locator('#startDistrict').getAttribute('aria-pressed'),'true');
  await page.locator('#launch').click();
  await assertWaypoint(page,1);
  await mapGraphic(page);
  await page.locator('#trailMapButton').click();
  await page.locator('#trailMap[open]').waitFor();
  assert.equal(await page.locator('.trail-option').count(),4);
  // Refresh the first target at the paused aircraft position: the last live HUD tick
  // can precede opening the chart by a fraction of a simulated second.
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('.trail-option').first().click();
  const highStreet=await mapGraphic(page);
  await page.locator('.trail-option').nth(1).click();
  await assertWaypoint(page,2);
  const riverBend=await mapGraphic(page);
  assert.ok(Math.hypot(riverBend.x-highStreet.x,riverBend.y-highStreet.y)>3,'Changing destination must move the highlighted waypoint');
  assert.equal(await page.locator('.trail-option').nth(1).getAttribute('aria-pressed'),'true');
  await page.screenshot({path:path.join(work,'test-route-map.png')});
  await page.locator('.trail-option').first().click();
  await assertWaypoint(page,1);
  const reselected=await mapGraphic(page);
  assert.ok(Math.hypot(reselected.x-highStreet.x,reselected.y-highStreet.y)<2,'Reselecting the original destination must return its highlighted waypoint to the original position');
  await page.keyboard.press('Escape');
  await page.locator('#trailMap').waitFor({state:'hidden'});
  // The preset starts 293 m outside gate one. Hold trim through both rows of towers.
  await page.locator('#trailRead').waitFor({timeout:70000});
  await assertWaypoint(page,2);
  assert.equal(await page.locator('#trailMap').isVisible(),false);
  await checkStoryCard(page,'en');
  await page.screenshot({path:path.join(work,'test-route-crossing.jpg'),quality:90});
  await page.locator('#trailRead').click();
  await page.locator('#historyView:not([hidden])').waitFor();
  assert.equal(await page.locator('.journal-story-title').innerText(),firstStory.en.title);
  assert.equal(new URL(page.url()).hash,'#history/'+firstStory.id);
  const stopped=await page.locator('#clock').textContent();
  assert.equal(await page.locator('.journal-count span').textContent(),'1 / 4');
  assert.equal(await page.locator('.timeline-item').count(),4);
  for(let i=0;i<4;i++){
    await page.locator('.timeline-item').nth(i).click();
    await page.waitForFunction(i=>document.querySelectorAll('.timeline-item')[i].getAttribute('aria-current')==='step',i);
    await page.waitForFunction(()=>document.querySelector('.journal-photo img')?.naturalWidth>=600);
    assert(await page.locator('.journal-prose').count()>0);
    assert(await page.locator('.photo-credit a').count()>=2);
  }
  assert(await page.locator('.shelf-item[href*="youtube.com/watch"]').count()>0);
  assert(await page.locator('.shelf-kind').filter({hasText:/^Book$/}).count()>=2);
  await assertModelArticle(page,'en');
  await page.locator('.timeline-item').nth(1).click();
  await page.waitForFunction(()=>document.querySelector('.journal-kicker').textContent.includes('Cockpit'));
  await page.screenshot({path:path.join(work,'test-journal.png')});
  await page.locator('#langRu').click();
  assert.equal(await page.locator('html').getAttribute('lang'),'ru');
  await assertModelArticle(page,'ru');
  assert((await page.locator('.journal-story-title').textContent()).includes('крыл'));
  assert.equal(await page.locator('#clock').textContent(),stopped);
  await page.locator('#langEn').click();await page.locator('#simTab').click();
  await page.locator('#simMain:not([hidden])').waitFor();
  await page.waitForFunction(()=>Number(document.querySelector('#clock').textContent.split(':')[1])>=20,null,{timeout:40000});
  await page.screenshot({path:path.join(work,'test-tower-flyby.jpg'),quality:90});
  await page.waitForFunction(()=>Number(document.querySelector('#clock').textContent.split(':')[1])>=39,null,{timeout:60000});
  assert.equal(await page.locator('#stateText').textContent(),'Airborne');
  await page.locator('#historyTab').click();await page.locator('#historyView:not([hidden])').waitFor();
  await page.locator('#langRu').click();await page.reload();
  await page.locator('.journal-count').waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'),'ru');
  assert.equal(await page.locator('.journal-count span').textContent(),'1 / 4');
  await page.locator('#langEn').click();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(work,'test-journal-mobile.png')});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
  await page.locator('.journal-fly:enabled').click();
  await page.locator('#simMain:not([hidden])').waitFor();
  await page.locator('#trailMapButton').click();await page.locator('#trailMap[open]').waitFor();
  await page.screenshot({path:path.join(work,'test-map-mobile.png')});
  await context.close();
  await touchFlight(browser,errors,requests);
  assert.equal(requests.length,0,'Unexpected network requests: '+requests.join(', '));
  assert.equal(errors.length,0,'Browser errors: '+errors.join(', '));
  console.log('PASS: default English, tower route traversed in trim, ring crossing, map selection, all four offline photographs, both languages, flight paused during reading, progress & locale persisted after reload, a persistent mini-map that retargets, EN/RU discovery cards with embedded photos and working chapter links, reset after a new flight, and clear touch HUD at 612×972, 390×844 and 844×390. No browser errors or external requests.');
}

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try{
  if(resourceOnly)await checkResourceRelease(browser,input);
  else await runJournal(browser);
}finally{await browser.close();}
