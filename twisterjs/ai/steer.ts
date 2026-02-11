import { clamp, wrapAngle } from "../math/scalar"
import { add, clampLength, dot, fromAngle, len2, length, mulScalar, normalize, normalizeSafe, sub, vec2, type Vec2 } from "../math/vec2"

/**
 * A moving agent to apply steering behaviors on
 */
export interface Agent {
  position: Vec2
  velocity: Vec2

  rotation: number
  angularVelocity: number

  radius: number
  mass: number

  maxSpeed: number
  maxForce: number
  
  turnRate: number // radians per second

  accumulatedForce: Vec2

  bounds_force?: Vec2
}

export type AgentParams = {
    radius: number
    mass: number
    maxSpeed: number
    maxForce: number
    turnRate: number
}

/**
 * Creates an agent
 */
export function agent(position: Vec2, params: AgentParams): Agent {
    return {
        position,
        velocity: vec2(),
        rotation: 0,
        angularVelocity: 0,
        ...params,
        accumulatedForce: vec2()
    }
}

export type SteeringForce = Vec2

/**
 * Interface for Steering Behaviors to implement
 * @param weight a unitless value of influence weight within all behaviors
 * @param compute returns a direction vector to steer towards
 */
export interface SteeringBehavior {
    weight: number
    compute(agent: Agent, dt: number): Vec2
}

type TargetProvider = () => Vec2 | undefined

export class Seek implements SteeringBehavior {

    weight: number
    speedFactor: number

    target: TargetProvider

    /**
     * Create a Seek Behavior that Seeks the provided target
     * @param weight weight of influence (a unitless value)
     * @param speedFactor a factor to multiply the Seek speed
     * @param target a TargetProvider that returns the position of the target
     */
    constructor(
        weight: number,
        speedFactor: number,
        target: TargetProvider,
    ) {
        this.weight = weight
        this.speedFactor = speedFactor

        this.target = target
    }

    compute(agent: Agent): Vec2 {

        let target = this.target()

        if (!target) {
            return vec2()
        }

        const toTarget = sub(target, agent.position)
        const dist = length(toTarget)

        // Epsilon to avoid floating point noise
        if (dist < 8) {
            return vec2()
        }

        const desired =
            mulScalar(normalize(toTarget), agent.maxSpeed * this.speedFactor)

        return mulScalar(sub(desired, agent.velocity), this.weight)
    }
}

export class Arrive implements SteeringBehavior {


    weight: number
    speedFactor: number

    target: TargetProvider
    slowRadius: number

    /**
     * Create an Arrive Behavior that Arrives at the provided target.
     * @param weight weight of influence (a unitless value)
     * @param speedFactor a factor to multiply the Seek speed
     * @param target a TargetProvider that returns the position of the target
     */
  constructor(
    weight: number,
    speedFactor: number,
    slowRadius: number,
    target: TargetProvider,
  ) {
    this.weight = weight
    this.speedFactor = speedFactor
    this.target = target
    this.slowRadius = slowRadius
  }

  compute(agent: Agent): Vec2 {

    let target = this.target()
    if (!target) {
      return vec2()
    }

    const toTarget = sub(target, agent.position)
    const dist = length(toTarget)

    if (dist === 0) return vec2()

    const speed = agent.maxSpeed * this.speedFactor * Math.min(dist / this.slowRadius, 1)
    const desired = mulScalar(normalize(toTarget), speed)

    return mulScalar(sub(desired, agent.velocity), this.weight)
  }
}

function computeSteering(
  agent: Agent,
  behaviors: SteeringBehavior[],
  dt: number
): Vec2 {
  let force = vec2()

  for (const b of behaviors) {
    force = add(force, b.compute(agent, dt))
  }

  return clampLength(force, agent.maxForce)
}

function updateHeading(body: Agent, dt: number) {
    const speedSq = dot(body.velocity, body.velocity)
    const EPS = 1e-6

    if (speedSq < EPS) return // no movement → no heading change

    const desired = Math.atan2(body.velocity.y, body.velocity.x)
    const delta = wrapAngle(desired - body.rotation)

    const turnRate = body.turnRate
    const maxTurn = turnRate * dt

    body.rotation += clamp(delta, -maxTurn, maxTurn)
}



/**
 * Call this within update loop every frame to update an Agent
 * @param body Agent to update
 * @param behaviors list of behaviors to apply
 * @param bounds list of Boundaries to apply collision detection
 * @param delta delta time in seconds
 */
export function update_agent(body: Agent, behaviors: SteeringBehavior[], bounds: Boundary[], delta: number) {

    let force = vec2()

    force = add(force, body.accumulatedForce)
    body.accumulatedForce = vec2()

    force = add(force, computeSteering(body, behaviors, delta))

    let bounds_force = vec2()
    let k = 500
    let damping = 10
    // 2. Collision constraints (spring-based)
    for (const boundary of bounds) {
        bounds_force = add(bounds_force, 
            resolveBoundaryWithSpringForce(boundary, body, k, damping))
    }

    force = add(force, bounds_force)

    if (len2(bounds_force) > .01) {
        body.bounds_force = bounds_force
    } else {
        delete body.bounds_force
    }

    body.velocity = add(body.velocity, 
        mulScalar(force, delta / body.mass)
    )

    // Velocity damping (friction)
    //const linearDamping = 6;
    //body.velocity = mulScalar(body.velocity, Math.exp(-linearDamping * delta));

    if (length(body.velocity) < .1) {
        body.velocity = vec2();
    }


    body.velocity = clampLength(body.velocity, body.maxSpeed)

    body.position = add(body.position, mulScalar(body.velocity, delta))

    updateHeading(body, delta)
}

function resolveBoundaryWithSpringForce(boundary: Boundary, body: Agent, k: number, damping: number) {
    const penetration = boundary.penetration(body.position)
    let penetrationDepth = -(penetration.signedDistance - body.radius)

    if (penetrationDepth > 0) {
        let normal = penetration.normal
        const spring = mulScalar(normal, penetrationDepth * k)
        const vn = dot(body.velocity, normal)

        const dampingForce = vn < 0 ? mulScalar(normal, - vn * damping) : vec2()

        return add(spring, dampingForce)
    }
    return vec2()
}

export type Penetration = {
    // Signed distance to the boundary surface
    // > 0  => penetration
    // = 0  => exactly on surface
    // < 0  => outside / free
    signedDistance: number

    // Surface normal at closest point
    normal: Vec2
}

export interface Boundary {
    penetration(p: Vec2): Penetration
}

export class WanderJitter implements SteeringBehavior {
    weight: number
    interval: number
    timer = 0
    wanderAngle = 0

    /**
     * Applies Jitter to movement
     * @param weight weight of influence
     * @param interval interval of time in seconds to apply the jitter at (periodic)
     */
    constructor(weight: number, interval = 0.25) {
        this.interval = interval
        this.weight = weight
        this.wanderAngle = Math.random() * Math.PI * 2
    }

    compute(agent: Agent, dt: number): Vec2 {
        this.timer -= dt

        if (this.timer <= 0) {
            const range = Math.PI
            this.wanderAngle += (Math.random() * 2 - 1) * range
            this.timer = this.interval
        }

        const dir = fromAngle(this.wanderAngle)
        return mulScalar(dir, agent.maxForce * this.weight)
    }
}



export class Wander implements SteeringBehavior {
    weight: number

    // Wander parameters
    circleDistance: number      // distance ahead of agent
    circleRadius: number        // radius of the wander circle
    jitter: number              // angular change per second (radians)

    private wanderAngle!: number

    /**
     * Applies a Smooth Wander behavior to movement
     * @param weight influence of weight
     * @param circleDistance controls smoothing factor
     * @param circleRadius controls jitter and smoothing factor
     * @param jitter controls jitter factor
     */
    constructor(
        weight: number,
        circleDistance = 40,
        circleRadius = 20,
        jitter = Math.PI / 2     // ~90° per second max
    ) {
        this.weight = weight
        this.circleDistance = circleDistance
        this.circleRadius = circleRadius
        this.jitter = jitter

        this.reset()
    }

    compute(agent: Agent, dt: number): Vec2 {
        // If agent is not moving, assume a forward direction
        const velocityDir = length(agent.velocity) > 0.0001
            ? normalize(agent.velocity)
            : vec2(1, 0)

        // Move the wander angle slightly (smooth randomness)
        const delta = (Math.random() * 2 - 1) * this.jitter * dt
        this.wanderAngle += delta

        // Center of wander circle
        const circleCenter = add(
            agent.position,
            mulScalar(velocityDir, this.circleDistance)
        )

        // Point on the circle
        const displacement = vec2(
            Math.cos(this.wanderAngle),
            Math.sin(this.wanderAngle)
        )

        const wanderTarget = add(
            circleCenter,
            mulScalar(displacement, this.circleRadius)
        )

        // Steering force toward the target
        const desired = sub(wanderTarget, agent.position)

        return mulScalar(normalizeSafe(desired), agent.maxForce * this.weight)
    }

    reset(directionHint?: Vec2) {
        if (directionHint && length(directionHint) > 0.0001) {
            this.wanderAngle = Math.atan2(directionHint.y, directionHint.x)
        } else {
            this.wanderAngle = Math.random() * Math.PI * 2
        }
    }
}

export class FlightAvoidance implements SteeringBehavior {
  weight: number
  obstacles: () => Obstacle[]
  radius: number
  falloff: number
  forwardBias: number

  /**
   * Flights away from obstacles
   * @param weight weight of influence
   * @param obstacles array of obstacles to flight away from
   * @param radius the distance of radius to keep away
   * @falloff controls smoothing factor (best to keep close to [1-2])
   * @forwardBias controls smoothing factor (best to keep between [0, 1])
   */
  constructor(
    weight: number,
    obstacles: () => Obstacle[],
    radius = 120,
    falloff = 2,
    forwardBias = 0.5
  ) {
    this.weight = weight
    this.obstacles = obstacles
    this.radius = radius
    this.falloff = falloff
    this.forwardBias = forwardBias
  }

  compute(agent: Agent): Vec2 {
    const speed = length(agent.velocity)
    if (speed === 0) return vec2()

    const fwd = normalize(agent.velocity)
    let force = vec2()

    for (const obs of this.obstacles()) {
      const offset = sub(agent.position, obs.position)
      const dist = length(offset)
      const R = this.radius + obs.radius

      if (dist >= R || dist === 0) continue

      let away = normalize(offset)

      // ---- Angular bias: remove backward component ----
      const backDot = dot(away, mulScalar(fwd, -1))
      if (backDot > 0) {
        away = sub(away, mulScalar(fwd, backDot))
      }

      // Fallback if numerically unstable
      if (len2(away) === 0) continue

      away = normalize(away)

      // Falloff strength
      const strength = Math.pow(1 - dist / R, this.falloff)

      // Forward bias keeps momentum
      const biased = add(
        mulScalar(away, 1 - this.forwardBias),
        mulScalar(fwd, this.forwardBias)
      )

      force = add(force, mulScalar(biased, strength))
    }

    if (len2(force) === 0) return vec2()

    force = normalize(force)
    force = mulScalar(force, agent.maxForce)

    return mulScalar(force, this.weight)
  }
}



/**
 * Represents an Obstacle with a position and a radius
 */
export type Obstacle = {
  position: Vec2,
  radius: number
}
