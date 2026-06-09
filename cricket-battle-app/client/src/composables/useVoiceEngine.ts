/**
 * 语音引擎 -- Web Speech API 语音播报，支持队列和优先级
 */

import { ref, readonly } from 'vue'
import type { VoicePriority } from '@shared/types'

interface VoiceTask {
  text: string
  priority: VoicePriority
}

const PRIORITY_ORDER: Record<VoicePriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
}

const isMuted = ref(false)
const volume = ref(1.0)
const rate = ref(1.0)
const isSpeaking = ref(false)

let queue: VoiceTask[] = []
let currentUtterance: SpeechSynthesisUtterance | null = null

export function useVoiceEngine() {
  function speak(text: string, priority: VoicePriority = 'normal'): void {
    if (isMuted.value) return
    if (!('speechSynthesis' in window)) return

    const task: VoiceTask = { text, priority }

    // urgent 直接打断当前播放
    if (priority === 'urgent') {
      speechSynthesis.cancel()
      queue = queue.filter((t) => t.priority === 'urgent')
      queue.unshift(task)
      processQueue()
      return
    }

    // 高优先级插队到前面
    const insertIndex = queue.findIndex((t) => PRIORITY_ORDER[t.priority] < PRIORITY_ORDER[priority])
    if (insertIndex === -1) {
      queue.push(task)
    } else {
      queue.splice(insertIndex, 0, task)
    }

    if (!isSpeaking.value) {
      processQueue()
    }
  }

  function processQueue(): void {
    if (queue.length === 0) {
      isSpeaking.value = false
      return
    }

    const task = queue.shift()!
    isSpeaking.value = true

    const utterance = new SpeechSynthesisUtterance(task.text)
    utterance.volume = volume.value
    utterance.rate = rate.value
    utterance.lang = 'zh-CN'

    // 尝试选择中文语音
    const voices = speechSynthesis.getVoices()
    const chineseVoice = voices.find((v) => v.lang.startsWith('zh'))
    if (chineseVoice) utterance.voice = chineseVoice

    currentUtterance = utterance

    utterance.onend = () => {
      currentUtterance = null
      processQueue()
    }

    utterance.onerror = () => {
      currentUtterance = null
      processQueue()
    }

    speechSynthesis.speak(utterance)
  }

  function setVolume(v: number): void {
    volume.value = Math.max(0, Math.min(1, v))
  }

  function setRate(r: number): void {
    rate.value = Math.max(0.5, Math.min(2, r))
  }

  function mute(): void {
    isMuted.value = true
    clearQueue()
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
  }

  function unmute(): void {
    isMuted.value = false
  }

  function clearQueue(): void {
    queue = []
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
    isSpeaking.value = false
    currentUtterance = null
  }

  return {
    isMuted: readonly(isMuted),
    isSpeaking: readonly(isSpeaking),
    speak,
    setVolume,
    setRate,
    mute,
    unmute,
    clearQueue,
  }
}
