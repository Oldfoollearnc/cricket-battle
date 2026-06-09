/**
 * 渲染引擎 -- Canvas 2D 粒子系统和视觉特效
 */

import type { ThemeConfig, RankingEntry, ParticleStyle } from '@shared/types'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
  alpha: number
}

export class RenderEngine {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private particles: Particle[] = []
  private animationId: number | null = null
  private theme: ThemeConfig | null = null
  private shakeIntensity = 0
  private shakeDecay = 0.92

  init(canvas: HTMLCanvasElement, theme: ThemeConfig): void {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.theme = theme
    this.resize()
    window.addEventListener('resize', this.resize)
    this.startLoop()
  }

  private resize = (): void => {
    if (!this.canvas || !this.ctx) return
    const dpr = window.devicePixelRatio || 1
    const rect = this.canvas.getBoundingClientRect()
    this.canvas.width = rect.width * dpr
    this.canvas.height = rect.height * dpr
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.scale(dpr, dpr)
  }

  private startLoop(): void {
    const loop = () => {
      this.update()
      this.render()
      this.animationId = requestAnimationFrame(loop)
    }
    this.animationId = requestAnimationFrame(loop)
  }

  private update(): void {
    // 更新粒子
    this.particles = this.particles.filter((p) => {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.15 // 重力
      p.life--
      p.alpha = p.life / p.maxLife
      return p.life > 0
    })

    // 衰减震动
    if (this.shakeIntensity > 0.5) {
      this.shakeIntensity *= this.shakeDecay
    } else {
      this.shakeIntensity = 0
    }
  }

  private render(): void {
    if (!this.ctx || !this.canvas) return
    const rect = this.canvas.getBoundingClientRect()
    const w = rect.width
    const h = rect.height

    this.ctx.save()

    // 应用震动偏移
    if (this.shakeIntensity > 0) {
      const offsetX = (Math.random() - 0.5) * this.shakeIntensity
      const offsetY = (Math.random() - 0.5) * this.shakeIntensity
      this.ctx.translate(offsetX, offsetY)
    }

    // 清除画布
    this.ctx.clearRect(-10, -10, w + 20, h + 20)

    // 渲染粒子
    for (const p of this.particles) {
      this.renderParticle(p)
    }

    this.ctx.restore()
  }

  private renderParticle(p: Particle): void {
    if (!this.ctx) return
    const style = this.theme?.particleStyle ?? 'explosion'

    this.ctx.globalAlpha = p.alpha

    switch (style) {
      case 'pixel':
        this.ctx.fillStyle = p.color
        this.ctx.fillRect(
          Math.floor(p.x - p.size / 2),
          Math.floor(p.y - p.size / 2),
          Math.ceil(p.size),
          Math.ceil(p.size),
        )
        break

      case 'minimal':
        this.ctx.fillStyle = p.color
        this.ctx.beginPath()
        this.ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2)
        this.ctx.fill()
        break

      case 'explosion':
      default:
        this.ctx.fillStyle = p.color
        this.ctx.shadowColor = p.color
        this.ctx.shadowBlur = p.size * 2
        this.ctx.beginPath()
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        this.ctx.fill()
        this.ctx.shadowBlur = 0
        break
    }

    this.ctx.globalAlpha = 1
  }

  playExplosion(x: number, y: number, color?: string): void {
    const particleColor = color ?? this.theme?.colors.success ?? '#00ff88'
    const count = 40

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
      const speed = 2 + Math.random() * 6
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 30 + Math.random() * 30,
        maxLife: 60,
        color: particleColor,
        size: 2 + Math.random() * 4,
        alpha: 1,
      })
    }

    // 内圈小粒子
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 1 + Math.random() * 3
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 15 + Math.random() * 15,
        maxLife: 30,
        color: '#ffffff',
        size: 1 + Math.random() * 2,
        alpha: 1,
      })
    }
  }

  playShake(intensity: number = 10, _duration: number = 300): void {
    this.shakeIntensity = intensity
  }

  playErrorFlash(): void {
    if (!this.canvas || !this.ctx) return
    const color = this.theme?.colors.error ?? '#ff3366'
    // 在四个角落产生红色粒子
    const w = this.canvas.getBoundingClientRect().width
    const h = this.canvas.getBoundingClientRect().height
    const corners = [[0, 0], [w, 0], [0, h], [w, h]]

    for (const [cx, cy] of corners) {
      for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 1 + Math.random() * 2
        this.particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 20 + Math.random() * 10,
          maxLife: 30,
          color,
          size: 2 + Math.random() * 3,
          alpha: 1,
        })
      }
    }

    this.playShake(8)
  }

  setTheme(theme: ThemeConfig): void {
    this.theme = theme
  }

  destroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    window.removeEventListener('resize', this.resize)
    this.particles = []
    this.canvas = null
    this.ctx = null
  }
}
