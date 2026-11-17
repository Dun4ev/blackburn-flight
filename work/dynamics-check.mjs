import assert from 'node:assert/strict';
import { Flight } from './dynamics.js';

function run(flight, seconds, controls = {}, hz = 60) {
  for (let i = 0; i < Math.round(seconds * hz); i++) flight.step(1 / hz, controls);
  for (const field of ['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'speed', 'throttle', 'verticalSpeed']) {
    assert.ok(Number.isFinite(flight[field]), field);
  }
  return flight;
}

const trim = run(new Flight(), 180);
assert.ok(Math.abs(trim.y - 125) < 0.001);
assert.ok(Math.abs(trim.speed * 3.6 - 78) < 0.001);
assert.equal(trim.stall, false);
assert.equal(trim.x, 0);
assert.ok(Math.abs(trim.z + 3780) < 0.001);
const top = run(new Flight(), 180, { throttle: 1 });
assert.ok(top.speed * 3.6 > 94 && top.speed * 3.6 < 98);

const lift = new Flight('ground');
let elapsed = 0;
while (lift.grounded && elapsed < 30) {
  lift.step(1 / 60, { throttle: 1, pitch: 1 });
  elapsed += 1 / 60;
}
const distance = 120 - lift.z;
assert.ok(elapsed < 20 && distance < 150 && distance > 80);
for (let i = 0; i < 1800; i++) {
  lift.step(1 / 60, { throttle: 1, pitch: 1 });
  assert.equal(lift.stall, false);
}
assert.ok(lift.y > 20 && lift.verticalSpeed > 0.5 && !lift.grounded);
assert.equal(run(new Flight('ground'), 25, { throttle: 1 }).grounded, false);
assert.equal(run(new Flight('ground'), 30, { pitch: 1, roll: 1 }).speed, 0);

const turn = run(new Flight(), 4, { roll: 0.75 });
assert.ok(turn.yaw > 0.5 && turn.x > 20 && turn.roll > 0.5);
const left = run(new Flight(), 4, { roll: -0.75 });
assert.ok(Math.abs(left.x + turn.x) < 1e-8);
run(turn, 8, { roll: 0 });
assert.ok(Math.abs(turn.roll) < 0.002);

const stall = run(new Flight(), 9, { pitch: 1, throttle: 0 });
assert.equal(stall.stall, true);
assert.ok(stall.verticalSpeed < 0);
run(stall, 10, { pitch: 0, throttle: 1 });
assert.equal(stall.stall, false);
assert.ok(stall.speed > 20 && !stall.grounded);

const landing = run(new Flight(), 120, { throttle: 0 });
assert.ok(landing.grounded && !landing.crashed && landing.speed === 0);
const hard = run(new Flight(), 30, { throttle: 0, pitch: -1 });
assert.ok(hard.grounded && hard.crashed);
const impactZ = hard.z;
run(hard, 3, { throttle: 1 });
assert.equal(hard.z, impactZ);
hard.reset('ground', () => 34);
run(hard, 2);
assert.ok(!hard.crashed && hard.grounded && hard.y === 34 && hard.speed === 0);
hard.reset('air');
assert.equal(hard.y, 159);

// A new approach is measured from the ground at its own start point.
const localTerrain = (x, z) => 20 + x * .01 + z * .005;
const approach = { x: 760, z: -242, agl: 55, yaw: Math.PI / 2 };
hard.reset('district', localTerrain, approach);
assert.equal(hard.y, localTerrain(approach.x, approach.z) + approach.agl);
assert.equal(hard.yaw, approach.yaw);
assert.equal(hard.speed, trim.speed);
run(hard, 1);
assert.ok(hard.x > approach.x + 21 && Math.abs(hard.z - approach.z) < 0.01);
hard.reset('ground', localTerrain);
assert.deepEqual([hard.x, hard.y, hard.z, hard.yaw], [0, localTerrain(0, 120), 120, 0]);

const hill = new Flight('air', (_x, z) => Math.max(0, -0.6 * z));
run(hill, 60);
assert.equal(hill.crashed, true);
const control = { roll: 0.4, pitch: 0.1, throttle: 1, yaw: -0.15 };
const quick = run(new Flight(), 5, control, 10);
const reference = run(new Flight(), 5, control, 60);
assert.ok(Math.abs(quick.x - reference.x) < 0.001 && Math.abs(quick.y - reference.y) < 0.001);
console.log('PASS: trim, speed, takeoff with and without elevator, parking, coordinated turn, centering, stall and recovery, soft landing, hard landing, reset, slopes and substepping.');
console.log(`Level full throttle: ${(top.speed * 3.6).toFixed(1)} km/h. Rotation: ${elapsed.toFixed(1)} s, ${distance.toFixed(0)} m. Full-stick climb: ${lift.verticalSpeed.toFixed(2)} m/s.`);
