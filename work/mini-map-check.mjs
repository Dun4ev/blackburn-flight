import assert from 'node:assert/strict';
import {miniView,projectMiniPoint,miniCourse} from './mini-map.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
const aircraft={x:310,z:-280,yaw:Math.PI/2};
const view=miniView(aircraft,160,96,200,0);
const center=projectMiniPoint(view,aircraft);
near(center.x,view.cx);near(center.y,view.cy);
const east=projectMiniPoint(view,{x:510,z:-280});
near(east.x,view.cx);assert(east.y<view.cy);assert(!east.clipped);assert.equal(miniCourse(east.angle),'ahead');
const north=projectMiniPoint(view,{x:310,z:-500});
assert(north.x<view.cx);near(north.y,view.cy);assert.equal(miniCourse(north.angle),'left');
const distant=projectMiniPoint(view,{x:-20000,z:-280});
assert(distant.clipped);near(distant.x,view.cx);near(distant.y,view.height-12);assert.equal(miniCourse(distant.angle),'behind');
assert.equal(miniCourse(-1.99*Math.PI),'ahead');assert.equal(miniCourse(2.4*Math.PI),'right');
for(const [a,b] of [
 [{x:760,z:-242},{x:760,z:-535}],
 [{x:760,z:-535},{x:1375,z:-1450}],
 [{x:1375,z:-1450},{x:-385,z:-790}],
 [{x:-385,z:-790},{x:0,z:10}],
]){
  for(const [width,height] of [[134,81],[168,102],[183,111]])for(const yaw of [0,.7,Math.PI,-1.5]){
    const distance=Math.hypot(b.x-a.x,b.z-a.z);
    const bearing=Math.atan2(b.x-a.x,a.z-b.z)-yaw;
    const map=miniView({...a,yaw},width,height,distance,bearing);
    const target=projectMiniPoint(map,b);
    assert(!target.clipped, `Route target cropped: ${width} px / yaw ${yaw}`);
    assert(target.x>=12&&target.x<=width-12&&target.y>=12&&target.y<=height-12);
    assert(map.cx>12&&map.cx<width-12&&map.cy>12&&map.cy<height-12);
  }
}
console.log('PASS: track-up rotation, compass wrapping, aft and off-map markers, all four route legs simultaneously fit aircraft and target at three chart dimensions and four headings.');
