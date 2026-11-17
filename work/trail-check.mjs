import assert from 'node:assert/strict';
import {crossesGate,makeGates} from './trail.js';
const gates=makeGates((x,z)=>x*.01+z*.003);
assert.equal(gates.length,4);
assert.equal(gates[0].x,760);
assert.equal(gates[0].z,-535);
for(const gate of gates){
  const pos=(longitudinal,side=0,vertical=0)=>({
    x:gate.x+gate.nx*longitudinal-gate.nz*side,
    y:gate.y-1.46+vertical,
    z:gate.z+gate.nz*longitudinal+gate.nx*side,
  });
  const yaw=Math.atan2(gate.nx,-gate.nz);
  assert(crossesGate(pos(-80),pos(120),gate,yaw));
  assert(crossesGate(pos(120),pos(-80),gate,yaw+Math.PI));
  assert(crossesGate(pos(-9,13),pos(9,13),gate,yaw));
  assert(!crossesGate(pos(-9,17),pos(9,17),gate,yaw)); // centre passes, outer wing misses
  assert(!crossesGate(pos(-9,0,25),pos(9,0,25),gate,yaw));
  assert(!crossesGate(pos(-20),pos(-1),gate,yaw));
  assert(!crossesGate(pos(4),pos(8),gate,yaw));
  assert(!crossesGate(pos(-4,30),pos(4,30),gate,yaw));
  assert(crossesGate(pos(-15,3,-2),pos(15,10,8),gate,yaw,25*Math.PI/180));
}
console.log('PASS: four apertures accept forward and reverse crossings, reject same-side segments, high passes, side misses and clipped wing tips.');
