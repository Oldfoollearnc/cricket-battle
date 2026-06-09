/**
 * VoiceEngine 单元测试
 * 注意：Web Speech API 在 happy-dom 中不可用，测试核心逻辑
 */

import { describe, it, expect, beforeEach } from 'vitest'

describe('useVoiceEngine', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('模块可以正常导入', async () => {
    const { useVoiceEngine } = await import('../useVoiceEngine')
    expect(typeof useVoiceEngine).toBe('function')
  })

  it('返回所有预期的方法', async () => {
    const { useVoiceEngine } = await import('../useVoiceEngine')
    const voice = useVoiceEngine()

    expect(typeof voice.speak).toBe('function')
    expect(typeof voice.setVolume).toBe('function')
    expect(typeof voice.setRate).toBe('function')
    expect(typeof voice.mute).toBe('function')
    expect(typeof voice.unmute).toBe('function')
    expect(typeof voice.clearQueue).toBe('function')
    expect(voice.isMuted.value).toBe(false)
    expect(voice.isSpeaking.value).toBe(false)
  })

  it('mute 后 isMuted 为 true', async () => {
    const { useVoiceEngine } = await import('../useVoiceEngine')
    const voice = useVoiceEngine()

    voice.mute()
    expect(voice.isMuted.value).toBe(true)
  })

  it('unmute 后 isMuted 为 false', async () => {
    const { useVoiceEngine } = await import('../useVoiceEngine')
    const voice = useVoiceEngine()

    voice.mute()
    voice.unmute()
    expect(voice.isMuted.value).toBe(false)
  })
})
