/** 
 * @private Steering Behaviors 
 * */
import { advanceAlongPath, closestPointOnSegment, collisionSurface, findClosestSegmentIndex, lateralOffset, type Poly } from "../math/polygon"
import { rect_bottom, rect_left, rect_right, rect_top, type Rect } from "../math/rect"
import { add, dot, len2, length, mulScalar, normalize, sub, vec2, type Vec2 } from "../math/vec2"
import type { Agent, Boundary, Obstacle, Penetration, SteeringBehavior } from "./steer"


export class BoundaryAvoidance implements SteeringBehavior {

    bounds: Rect
    margin: number
    strength: number
    weight: number

  constructor(
    weight: number,
    bounds: Rect,
    margin: number,
    strength: number,
  ) {
    this.bounds = bounds
    this.margin = margin
    this.strength = strength
    this.weight = weight
  }

  compute(agent: Agent): Vec2 {
    let force = vec2()

    if (agent.position.x < rect_left(this.bounds) + this.margin)
      force.x += this.strength
    if (agent.position.x > rect_right(this.bounds) - this.margin)
      force.x -= this.strength

    if (agent.position.y < rect_top(this.bounds) + this.margin)
      force.y += this.strength
    if (agent.position.y > rect_bottom(this.bounds) - this.margin)
      force.y -= this.strength

    return mulScalar(force, this.weight)
  }
}



export class SeparationBehavior implements SteeringBehavior {

    neighbors: () => Vec2[]
    desiredSeparation: number
    weight: number

    constructor(
        neighbors: () => Vec2[],
        desiredSeparation: number,
        weight = 1
    ) {
        this.neighbors = neighbors
        this.desiredSeparation = desiredSeparation
        this.weight = weight
    }

    compute(body: Agent): Vec2 {
        let force = vec2()
        let count = 0

        for (const pos of this.neighbors()) {
            const toAgent = sub(body.position, pos)
            const d = length(toAgent)

            if (d > 0 && d < this.desiredSeparation) {
                force = add(force,
                    mulScalar(normalize(toAgent), 1 / d)
                )
                count++
            }
        }

        if (count > 0) {
            force = mulScalar(force, 1 / count)
        }

        if (length(force) > 0) {
            force = mulScalar(normalize(force), body.maxSpeed)
            force = sub(force, body.velocity)
        }

        return force
    }
}



export class ConvexPolygonBoundary implements Boundary {

    poly: Poly

    constructor(poly: Poly) { 
        this.poly = poly
    }

    penetration(p: Vec2): Penetration {
        return collisionSurface(this.poly, p)
    }
}



export class ObstacleAvoidance implements SteeringBehavior {
  weight: number
  obstacles: () => Obstacle[]
  lookAhead: number

  constructor(
    weight: number,
    obstacles: () => Obstacle[],
    lookAhead = 100,
  ) {
    this.weight = weight
    this.obstacles = obstacles
    this.lookAhead = lookAhead
  }

  compute(agent: Agent): Vec2 {
    const speed = length(agent.velocity)
    if (speed === 0) return vec2()

    const forward = normalize(agent.velocity)

    // Prevent lookAhead collapse at low speeds
    const dynamicLookAhead = Math.max(
      this.lookAhead * (speed / agent.maxSpeed),
      agent.radius * 2
    )

    let closestT = Infinity
    let threat: Obstacle | null = null
    let hitPoint = vec2()

    let penetration = 0

    for (const obs of this.obstacles()) {
      const R = agent.radius + obs.radius

      // Vector from agent to obstacle
      const toObs = sub(obs.position, agent.position)

      // Project onto forward vector
      const t = dot(toObs, forward)

      // Outside swept segment
      if (t < 0 || t > dynamicLookAhead) continue

      // Closest point on sweep segment
      const closest = add(agent.position, mulScalar(forward, t))

      // Distance from obstacle center to sweep axis
      const distSq = len2(sub(obs.position, closest))

      if (distSq > R * R) continue

      // Keep nearest intersection
      if (t < closestT) {
        closestT = t
        threat = obs
        hitPoint = closest
        penetration = 1 - Math.sqrt(distSq) / R
      }
    }

    if (!threat) return vec2()

    // Lateral avoidance force (push out of capsule)
    const avoidanceDir = normalize(
      sub(hitPoint, threat.position)
    )

    const force = mulScalar(avoidanceDir, agent.maxForce * penetration)

    return mulScalar(force, this.weight)
  }
}




export type Path = Poly

export class PathFollow implements SteeringBehavior {

  weight: number
  speedFactor: number

  path: Path
  lookAhead: number
  arriveRadius: number

  private segmentIndex = 0

  constructor(
    weight: number,
    speedFactor: number,
    path: Path,
    lookAhead = 40,
    arriveRadius = 8,
  ) {
    this.weight = weight
    this.speedFactor = speedFactor
    this.path = path
    this.lookAhead = lookAhead
    this.arriveRadius = arriveRadius
  }

  compute(agent: Agent): Vec2 {
    if (this.path.points.length < 2) {
      return vec2()
    }

    this.segmentIndex = findClosestSegmentIndex(agent.position, this.path)

    // 1. Find closest point on current segment
    const a = this.path.points[this.segmentIndex % this.path.points.length]!
    const b = this.path.points[(this.segmentIndex + 1) % this.path.points.length]!

    let closest = closestPointOnSegment(agent.position, a, b)

    /*
    // 2. If near end of segment, advance segment index
    if (distance(closest.point, b) < this.arriveRadius) {
      this.segmentIndex++
    }
      */

    // 3. Compute carrot point ahead on path
    const { point: target } = advanceAlongPath(
      this.path,
      this.segmentIndex,
      closest.point,
      this.lookAhead
    )

    // 4. Seek the carrot
    const desired = sub(target, agent.position)
    const dist = length(desired)

    if (dist < 0.0001) {
      return vec2()
    }

    const desiredVelocity = mulScalar(
      normalize(desired),
      agent.maxSpeed * this.speedFactor
    )

    const steering = sub(desiredVelocity, agent.velocity)

    return mulScalar(steering, this.weight)
  }
}


export class CorridorFollow implements SteeringBehavior {
  path: Path
  weight: number
  corridorRadius: number
  stiffness: number

  private segmentIndex = 0

  constructor(
    weight: number,
    path: Path,
    corridorRadius = 24,
    stiffness = 1,
  ) {
    this.path = path
    this.corridorRadius = corridorRadius
    this.stiffness = stiffness
    this.weight = weight
  }

  compute(agent: Agent): Vec2 {
    if (this.path.points.length < 2) {
      return vec2()
    }

    const a = this.path.points[this.segmentIndex % this.path.points.length]!
    const b = this.path.points[(this.segmentIndex + 1) % this.path.points.length]!

    const { offset, normal } =
      lateralOffset(agent.position, a, b)

    // Advance segment if agent passed it
    const segmentDir = normalize(sub(b, a))
    if (dot(sub(agent.position, b), segmentDir) > 0) {
      this.segmentIndex++
    }

    const absOffset = Math.abs(offset)

    // Inside corridor → no correction
    if (absOffset < this.corridorRadius) {
      return vec2()
    }

    // Outside corridor → push back toward centerline
    const penetration = absOffset - this.corridorRadius
    const direction = offset > 0 ? -1 : 1

    const correction = mulScalar(
      normal,
      penetration * direction * this.stiffness
    )

    return mulScalar(correction, this.weight)
  }
}
