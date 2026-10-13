/**
 * 群鸟算法(Boids)纯逻辑模拟,与渲染层解耦。
 *
 * 三大经典规则:分离(separation)、对齐(alignment)、聚合(cohesion),
 * 用空间哈希网格把邻居查询从 O(n²) 降到近似 O(n),支撑 1000 只鸟 60fps。
 *
 * 「混乱 → 整体」过程:对齐/聚合权重与随机扰动由 ramp(0→1,约 12s)驱动,
 * 初始每只鸟随机位置、随机方向高速乱飞,随后逐渐被三大规则收拢成一个整体。
 */

export const MAX_BIRDS = 1000
export const MIN_BIRDS = 100

export interface BoidsParams {
  /** 邻居感知半径(px) */
  perception: number
  /** 分离距离(px),小于该距离产生强斥力 */
  separationDist: number
  maxSpeed: number
  minSpeed: number
  /** 转向力上限(px/s²) */
  maxForce: number
  /** 混乱 → 集群 的过渡时长(s) */
  rampDuration: number
  /** 鼠标引导作用半径(px) */
  pointerRadius: number
}

const DEFAULTS: BoidsParams = {
  perception: 64,
  separationDist: 24,
  maxSpeed: 165,
  minSpeed: 70,
  maxForce: 340,
  rampDuration: 12,
  pointerRadius: 320,
}

const WRAP_MARGIN = 24
const POINTER_MEMORY = 1.4

export class BoidsSimulation {
  readonly px = new Float32Array(MAX_BIRDS)
  readonly py = new Float32Array(MAX_BIRDS)
  readonly vx = new Float32Array(MAX_BIRDS)
  readonly vy = new Float32Array(MAX_BIRDS)

  count: number
  width: number
  height: number
  params: BoidsParams = { ...DEFAULTS }

  /** 内部时钟(s) */
  private elapsed = 0

  pointer = { x: 0, y: 0, lastMove: -1e9 }

  private grid = new Map<number, number[]>()
  private cols = 1
  private rows = 1

  constructor(width: number, height: number, count: number) {
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    this.count = clampInt(count, MIN_BIRDS, MAX_BIRDS)
    this.scatter()
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
  }

  /** 调整鸟群规模:新增的鸟随机落位 */
  setCount(n: number): void {
    const next = clampInt(n, MIN_BIRDS, MAX_BIRDS)
    for (let i = this.count; i < next; i++) this.spawnAt(i)
    this.count = next
  }

  /** 打散鸟群:随机位置 + 随机方向,并重置过渡进度,重新演示合并过程 */
  scatter(): void {
    for (let i = 0; i < this.count; i++) this.spawnAt(i)
    this.elapsed = 0
  }

  /** 过渡进度 0(混乱)→ 1(完全集群),smoothstep 缓动 */
  get cohesion(): number {
    const t = Math.min(1, this.elapsed / this.params.rampDuration)
    return t * t * (3 - 2 * t)
  }

  get isPointerActive(): boolean {
    return this.elapsed - this.pointer.lastMove < POINTER_MEMORY
  }

  movePointer(x: number, y: number): void {
    this.pointer.x = x
    this.pointer.y = y
    this.pointer.lastMove = this.elapsed
  }

  releasePointer(): void {
    this.pointer.lastMove = -1e9
  }

  /** 点击/按下:以 (x,y) 为中心的斥力脉冲,把附近的鸟惊散 */
  pulse(x: number, y: number, radius = 180, strength = 260): void {
    const r2 = radius * radius
    for (let i = 0; i < this.count; i++) {
      const dx = this.px[i] - x
      const dy = this.py[i] - y
      const d2 = dx * dx + dy * dy
      if (d2 > r2 || d2 < 1e-6) continue
      const d = Math.sqrt(d2)
      const k = (1 - d / radius) * strength
      this.vx[i] += (dx / d) * k
      this.vy[i] += (dy / d) * k
    }
  }

  step(dtRaw: number): void {
    const dt = Math.min(Math.max(dtRaw, 0), 1 / 30)
    if (dt === 0) return
    this.elapsed += dt

    const ramp = this.cohesion
    const { perception, separationDist, maxSpeed, minSpeed, maxForce, pointerRadius } = this.params
    const perc2 = perception * perception
    const sep2 = separationDist * separationDist

    const wSep = 1.6
    const wAli = 1.0 * ramp
    const wCoh = 0.9 * ramp
    const wPointer = this.isPointerActive ? 1.5 : 0
    const jitter = (1 - ramp) * 300

    this.buildGrid(perception)
    const grid = this.grid
    const cols = this.cols

    // 全局质心:弱引力把多个子群最终收拢成「一个整体」
    let meanX = 0
    let meanY = 0
    for (let i = 0; i < this.count; i++) {
      meanX += this.px[i]
      meanY += this.py[i]
    }
    meanX /= this.count
    meanY /= this.count
    const wGlobal = 0.3 * ramp

    for (let i = 0; i < this.count; i++) {
      const x = this.px[i]
      const y = this.py[i]
      const cvx = this.vx[i]
      const cvy = this.vy[i]

      let sepX = 0
      let sepY = 0
      let aliX = 0
      let aliY = 0
      let cohX = 0
      let cohY = 0
      let neighbors = 0

      const cx = this.cellX(x, perception)
      const cy = this.cellY(y, perception)
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        if (gy < 0 || gy >= this.rows) continue
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          if (gx < 0 || gx >= cols) continue
          const bucket = grid.get(gx + gy * cols)
          if (!bucket) continue
          for (let b = 0; b < bucket.length; b++) {
            const j = bucket[b]
            if (j === i) continue
            const dx = this.px[j] - x
            const dy = this.py[j] - y
            const d2 = dx * dx + dy * dy
            if (d2 >= perc2 || d2 < 1e-8) continue
            neighbors++
            aliX += this.vx[j]
            aliY += this.vy[j]
            cohX += this.px[j]
            cohY += this.py[j]
            if (d2 < sep2) {
              const inv = 1 / d2
              sepX -= dx * inv
              sepY -= dy * inv
            }
          }
        }
      }

      let ax = 0
      let ay = 0

      if (neighbors > 0) {
        // 对齐:朝邻居平均速度方向转向
        steer(aliX / neighbors, aliY / neighbors, cvx, cvy, maxSpeed, maxForce)
        ax += steerX * wAli
        ay += steerY * wAli

        // 聚合:朝邻居质心转向
        steer(cohX / neighbors - x, cohY / neighbors - y, cvx, cvy, maxSpeed, maxForce)
        ax += steerX * wCoh
        ay += steerY * wCoh
      }

      // 分离:远离过近的同伴(权重不随 ramp 衰减,避免早期叠成一团)
      if (sepX !== 0 || sepY !== 0) {
        steer(sepX, sepY, cvx, cvy, maxSpeed, maxForce)
        ax += steerX * wSep
        ay += steerY * wSep
      }

      // 全局弱引力:多个子群最终合并为一个整体
      if (wGlobal > 0) {
        steer(meanX - x, meanY - y, cvx, cvy, maxSpeed, maxForce)
        ax += steerX * wGlobal
        ay += steerY * wGlobal
      }

      // 鼠标引导:在作用半径内向指针转向
      if (wPointer > 0) {
        const dx = this.pointer.x - x
        const dy = this.pointer.y - y
        const d2 = dx * dx + dy * dy
        if (d2 < pointerRadius * pointerRadius && d2 > 1e-6) {
          steer(dx, dy, cvx, cvy, maxSpeed, maxForce)
          ax += steerX * wPointer
          ay += steerY * wPointer
        }
      }

      // 混乱期的随机扰动,ramp 拉满后消失
      if (jitter > 0) {
        ax += (Math.random() * 2 - 1) * jitter
        ay += (Math.random() * 2 - 1) * jitter
      }

      let nvx = cvx + ax * dt
      let nvy = cvy + ay * dt

      // 限速:介于 minSpeed 与 maxSpeed 之间,保证鸟永远在飞
      const sp2 = nvx * nvx + nvy * nvy
      if (sp2 > maxSpeed * maxSpeed) {
        const k = maxSpeed / Math.sqrt(sp2)
        nvx *= k
        nvy *= k
      } else if (sp2 < minSpeed * minSpeed) {
        const k = sp2 < 1e-8 ? minSpeed : minSpeed / Math.sqrt(sp2)
        nvx *= k
        nvy *= k
      }

      this.vx[i] = nvx
      this.vy[i] = nvy

      // 环形绕边
      let nx = x + nvx * dt
      let ny = y + nvy * dt
      const w = this.width + WRAP_MARGIN * 2
      const h = this.height + WRAP_MARGIN * 2
      if (nx < -WRAP_MARGIN) nx += w
      else if (nx > this.width + WRAP_MARGIN) nx -= w
      if (ny < -WRAP_MARGIN) ny += h
      else if (ny > this.height + WRAP_MARGIN) ny -= h
      this.px[i] = nx
      this.py[i] = ny
    }
  }

  private spawnAt(i: number): void {
    this.px[i] = Math.random() * this.width
    this.py[i] = Math.random() * this.height
    const angle = Math.random() * Math.PI * 2
    const speed =
      this.params.minSpeed + Math.random() * (this.params.maxSpeed - this.params.minSpeed)
    this.vx[i] = Math.cos(angle) * speed
    this.vy[i] = Math.sin(angle) * speed
  }

  private cellX(x: number, cell: number): number {
    return clampInt(Math.floor((x + WRAP_MARGIN) / cell), 0, this.cols - 1)
  }

  private cellY(y: number, cell: number): number {
    return clampInt(Math.floor((y + WRAP_MARGIN) / cell), 0, this.rows - 1)
  }

  private buildGrid(cell: number): void {
    this.cols = Math.max(1, Math.ceil((this.width + WRAP_MARGIN * 2) / cell))
    this.rows = Math.max(1, Math.ceil((this.height + WRAP_MARGIN * 2) / cell))
    const grid = this.grid
    grid.clear()
    for (let i = 0; i < this.count; i++) {
      const key = this.cellX(this.px[i], cell) + this.cellY(this.py[i], cell) * this.cols
      const bucket = grid.get(key)
      if (bucket) bucket.push(i)
      else grid.set(key, [i])
    }
  }
}

/** Reynolds 转向力结果(模块级 scratch,避免每帧每鸟分配数组) */
let steerX = 0
let steerY = 0

/** Reynolds 转向力:desired 归一到 maxSpeed 后与当前速度求差,并限幅 maxForce,结果写入 steerX/steerY */
function steer(
  dx: number,
  dy: number,
  cvx: number,
  cvy: number,
  maxSpeed: number,
  maxForce: number,
): void {
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1e-8) {
    steerX = 0
    steerY = 0
    return
  }
  let fx = (dx / len) * maxSpeed - cvx
  let fy = (dy / len) * maxSpeed - cvy
  const fl2 = fx * fx + fy * fy
  if (fl2 > maxForce * maxForce) {
    const k = maxForce / Math.sqrt(fl2)
    fx *= k
    fy *= k
  }
  steerX = fx
  steerY = fy
}

function clampInt(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(v)))
}
