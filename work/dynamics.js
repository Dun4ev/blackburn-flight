// A forgiving point-mass model. Distances are metres, time is seconds, angles are radians.
const G = 9.81;
const DEG = Math.PI / 180;
const TRIM_SPEED = 78 / 3.6;
const TRIM_PITCH = 2.4 * DEG;
const TRIM_THROTTLE = (0.29 + 0.00165 * TRIM_SPEED ** 2 + 0.12) / (1.97 - 0.016 * TRIM_SPEED);
const FLAT = () => 0;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const relax = (value, target, rate, dt) => value + (target - value) * -Math.expm1(-rate * dt);
const axis = value => Number.isFinite(value) ? clamp(value, -1, 1) : 0;

export class Flight {
  constructor(mode = 'air', heightAt = FLAT) {
    this.reset(mode, heightAt);
  }

  reset(mode = 'air', heightAt = this._heightAt ?? FLAT, spawn = {}) {
    this._heightAt = heightAt;
    this.x = spawn.x ?? 0;
    this.z = spawn.z ?? 120;
    this.grounded = mode === 'ground';
    this.y = heightAt(this.x, this.z) + (this.grounded ? 0 : spawn.agl ?? 125);
    this.yaw = spawn.yaw ?? 0;
    this.pitch = this.grounded ? 8 * DEG : TRIM_PITCH;
    this.roll = 0;
    this.speed = this.grounded ? 0 : TRIM_SPEED;
    this.throttle = this.grounded ? 0 : TRIM_THROTTLE;
    this.verticalSpeed = 0;
    this.crashed = false;
    this.stall = false;
    this._flightPath = 0;
    this._rollRate = 0;
    this._pitchRate = 0;
    this._rotationDelay = 0;
    return this;
  }

  step(dt, input = {}, heightAt = this._heightAt) {
    if (this.crashed || !Number.isFinite(dt) || dt <= 0) return;
    // Substeps keep impact and damping consistent across fast and slow displays.
    const elapsed = Math.min(dt, 1);
    const steps = Math.ceil(elapsed * 60);
    const h = elapsed / steps;
    const pitchInput = axis(input.pitch);
    const rollInput = axis(input.roll);
    const yawInput = axis(input.yaw);
    if (Number.isFinite(input.throttle)) this.throttle = clamp(input.throttle, 0, 1);
    for (let i = 0; i < steps && !this.crashed; i++) {
      if (this.grounded) this._groundStep(h, pitchInput, rollInput, yawInput, heightAt);
      else this._airStep(h, pitchInput, rollInput, yawInput, heightAt);
    }
  }

  _advance(dt, horizontalSpeed) {
    this.x += Math.sin(this.yaw) * horizontalSpeed * dt;
    this.z -= Math.cos(this.yaw) * horizontalSpeed * dt;
  }

  _groundStep(dt, pitchInput, rollInput, yawInput, heightAt) {
    const rollingResistance = 0.34 + 0.44 * (1 - this.throttle);
    const thrust = (2.02 - 0.021 * this.speed) * this.throttle;
    const drag = 0.00136 * this.speed ** 2;
    this.speed = Math.max(0, this.speed + (thrust - drag - rollingResistance) * dt);
    const slipstream = clamp(this.speed / 9, 0, 1);
    this.yaw += (yawInput + 0.35 * rollInput) * slipstream * 12 * DEG * dt;
    const tailDown = 8 * DEG * clamp(1 - this.speed / 15, 0, 1);
    this.pitch = relax(this.pitch, tailDown + pitchInput * slipstream * 9 * DEG, 2.4, dt);
    this.roll = relax(this.roll, 0, 2.5, dt);
    this._advance(dt, this.speed);
    this.y = heightAt(this.x, this.z);
    this.verticalSpeed = 0;
    this._rotationDelay = Math.max(0, this._rotationDelay - dt);
    const rotated = pitchInput > 0.16 && this.pitch > 2.5 * DEG && this.speed > 17.4;
    const liftingWithoutInput = this.throttle > 0.84 && pitchInput >= 0 && this.speed > 22.3;
    if (this._rotationDelay === 0 && this.throttle > 0.4 && (rotated || liftingWithoutInput)) {
      this.grounded = false;
      this.pitch = Math.max(this.pitch, 5 * DEG);
      this._flightPath = 3.5 * DEG;
      this.verticalSpeed = this.speed * Math.sin(this._flightPath);
      this.y += 0.025;
    }
  }

  _airStep(dt, pitchInput, rollInput, yawInput, heightAt) {
    // Wing warping responds progressively, with lighter authority near the stall.
    const authority = clamp((this.speed - 8) / 11, 0.34, 1);
    const targetRoll = rollInput * 48 * DEG;
    this._rollRate = relax(this._rollRate, (targetRoll - this.roll) * 1.7 * authority, 3.7, dt);
    this.roll += this._rollRate * dt;
    const loadFactor = 1 / Math.max(0.55, Math.cos(this.roll));
    const stallSpeed = 15.1 * Math.sqrt(loadFactor) * (1 + 0.105 * Math.max(0, pitchInput));
    this.stall = this.speed < stallSpeed + (this.stall ? 1.1 : 0);
    const liftLoss = clamp((stallSpeed + 0.45 - this.speed) / 3.6, 0, 1);
    const targetPitch = TRIM_PITCH + pitchInput * 16 * DEG - liftLoss * 12 * DEG;
    this._pitchRate = relax(this._pitchRate, (targetPitch - this.pitch) * 1.65, 3.35, dt);
    this.pitch += this._pitchRate * dt;

    this.yaw += (G * Math.tan(this.roll) / Math.max(11, this.speed)
      + yawInput * 8 * DEG * authority) * dt;
    // At lower dynamic pressure, supporting the weight consumes a larger angle of attack.
    const lowSpeedSink = Math.max(0, (TRIM_SPEED - 0.32) * Math.sqrt(loadFactor) - this.speed);
    const targetPath = this.pitch - TRIM_PITCH - 0.041 * lowSpeedSink
      - 0.077 * (loadFactor - 1) - 0.29 * liftLoss;
    this._flightPath = relax(this._flightPath, clamp(targetPath, -0.69, 0.42), 1.2, dt);
    const thrust = this.throttle * Math.max(0, 1.97 - 0.016 * this.speed);
    const drag = 0.29 + 0.00165 * this.speed ** 2
      + 0.12 * (loadFactor * TRIM_SPEED / Math.max(10, this.speed)) ** 2 + 0.42 * liftLoss;
    const acceleration = thrust - drag - G * Math.sin(this._flightPath);
    this.speed = Math.max(4, this.speed + acceleration * dt);
    this.verticalSpeed = this.speed * Math.sin(this._flightPath);
    const oldGround = heightAt(this.x, this.z);
    this._advance(dt, this.speed * Math.cos(this._flightPath));
    this.y += this.verticalSpeed * dt;
    const ground = heightAt(this.x, this.z);
    if (this.y > ground) return;

    const closure = (ground - oldGround) / dt - this.verticalSpeed;
    this.y = ground;
    this.grounded = true;
    this.crashed = closure > 3.05 || Math.abs(this.roll) > 18 * DEG || this.pitch < -10 * DEG;
    this.stall = false;
    this._rollRate = 0;
    this._pitchRate = 0;
    this._flightPath = 0;
    this.verticalSpeed = 0;
    this._rotationDelay = 1.2;
    if (this.crashed) {
      this.speed = 0;
      this.throttle = 0;
    }
  }
}
