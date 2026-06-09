/**
 * PlayerStats Store 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePlayerStatsStore } from '../playerStats'
import type { MatchResult } from '@shared/types'

describe('usePlayerStatsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  function createMatch(overrides: Partial<MatchResult> = {}): MatchResult {
    return {
      playerId: 'player1',
      playerName: 'TestPlayer',
      isWinner: true,
      score: 500,
      correctCount: 8,
      totalQuestions: 10,
      avgResponseTime: 2000,
      fastestTime: 500,
      duration: 60000,
      opponentCount: 1,
      timestamp: Date.now(),
      ...overrides,
    }
  }

  it('初始状态为空', () => {
    const store = usePlayerStatsStore()
    expect(store.stats.totalMatches).toBe(0)
    expect(store.stats.wins).toBe(0)
    expect(store.winRatePercent).toBe(0)
  })

  it('记录胜利场次', () => {
    const store = usePlayerStatsStore()
    store.recordMatch(createMatch({ isWinner: true }))

    expect(store.stats.totalMatches).toBe(1)
    expect(store.stats.wins).toBe(1)
    expect(store.stats.losses).toBe(0)
    expect(store.winRatePercent).toBe(100)
  })

  it('记录失败场次', () => {
    const store = usePlayerStatsStore()
    store.recordMatch(createMatch({ isWinner: false }))

    expect(store.stats.totalMatches).toBe(1)
    expect(store.stats.wins).toBe(0)
    expect(store.stats.losses).toBe(1)
    expect(store.winRatePercent).toBe(0)
  })

  it('正确计算胜率', () => {
    const store = usePlayerStatsStore()
    store.recordMatch(createMatch({ isWinner: true }))
    store.recordMatch(createMatch({ isWinner: false }))
    store.recordMatch(createMatch({ isWinner: true }))

    expect(store.winRatePercent).toBe(67)
  })

  it('正确计算连胜', () => {
    const store = usePlayerStatsStore()
    store.recordMatch(createMatch({ isWinner: true }))
    store.recordMatch(createMatch({ isWinner: true }))
    store.recordMatch(createMatch({ isWinner: false }))
    store.recordMatch(createMatch({ isWinner: true }))
    store.recordMatch(createMatch({ isWinner: true }))
    store.recordMatch(createMatch({ isWinner: true }))

    const streak = store.getStreak()
    expect(streak.current).toBe(3)
    expect(streak.best).toBe(3)
  })

  it('失败重置当前连胜', () => {
    const store = usePlayerStatsStore()
    store.recordMatch(createMatch({ isWinner: true }))
    store.recordMatch(createMatch({ isWinner: true }))
    store.recordMatch(createMatch({ isWinner: false }))

    const streak = store.getStreak()
    expect(streak.current).toBe(0)
    expect(streak.best).toBe(2)
  })

  it('正确累计正确题数', () => {
    const store = usePlayerStatsStore()
    store.recordMatch(createMatch({ correctCount: 8, totalQuestions: 10 }))
    store.recordMatch(createMatch({ correctCount: 6, totalQuestions: 10 }))

    expect(store.stats.totalCorrect).toBe(14)
    expect(store.stats.totalQuestions).toBe(20)
  })

  it('正确记录最佳时间', () => {
    const store = usePlayerStatsStore()
    store.recordMatch(createMatch({ fastestTime: 1500 }))
    store.recordMatch(createMatch({ fastestTime: 800 }))
    store.recordMatch(createMatch({ fastestTime: 1200 }))

    expect(store.stats.bestTime).toBe(800)
  })

  it('导出数据为 JSON', () => {
    const store = usePlayerStatsStore()
    store.recordMatch(createMatch())

    const exported = store.exportData()
    const parsed = JSON.parse(exported)
    expect(parsed.totalMatches).toBe(1)
  })

  it('重置统计清空所有数据', () => {
    const store = usePlayerStatsStore()
    store.recordMatch(createMatch())
    store.recordMatch(createMatch())

    store.resetStats()
    expect(store.stats.totalMatches).toBe(0)
    expect(store.stats.wins).toBe(0)
  })

  it('比赛历史最多保留 100 条', () => {
    const store = usePlayerStatsStore()
    for (let i = 0; i < 110; i++) {
      store.recordMatch(createMatch({ timestamp: Date.now() + i }))
    }

    expect(store.stats.matchHistory.length).toBe(100)
  })
})
