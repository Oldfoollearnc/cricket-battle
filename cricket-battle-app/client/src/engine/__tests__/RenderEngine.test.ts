/**
 * RenderEngine 单元测试
 * Canvas API 在 happy-dom 中部分可用，测试核心逻辑
 */

import { describe, it, expect, vi } from 'vitest'
import { RenderEngine } from '../RenderEngine'
import type { ThemeConfig } from '@shared/types'

const mockTheme: ThemeConfig = {
  name: 'test',
  label: 'Test',
  colors: {
    primary: '#00f0ff',
    secondary: '#ff00aa',
    background: '#000',
    surface: '#111',
    text: '#fff',
    textSecondary: '#aaa',
    success: '#0f0',
    error: '#f00',
    warning: '#ff0',
    accent: '#f0f',
  },
  fontFamily: 'sans-serif',
  particleStyle: 'explosion',
  isCustom: false,
}

describe('RenderEngine', () => {
  it('创建实例不抛异常', () => {
    const engine = new RenderEngine()
    expect(engine).toBeTruthy()
  })

  it('destroy 不抛异常（未初始化时）', () => {
    const engine = new RenderEngine()
    expect(() => engine.destroy()).not.toThrow()
  })

  it('playExplosion 不抛异常（未初始化时）', () => {
    const engine = new RenderEngine()
    expect(() => engine.playExplosion(100, 100)).not.toThrow()
  })

  it('playShake 不抛异常（未初始化时）', () => {
    const engine = new RenderEngine()
    expect(() => engine.playShake(10)).not.toThrow()
  })

  it('playErrorFlash 不抛异常（未初始化时）', () => {
    const engine = new RenderEngine()
    expect(() => engine.playErrorFlash()).not.toThrow()
  })

  it('setTheme 不抛异常', () => {
    const engine = new RenderEngine()
    expect(() => engine.setTheme(mockTheme)).not.toThrow()
  })
})
