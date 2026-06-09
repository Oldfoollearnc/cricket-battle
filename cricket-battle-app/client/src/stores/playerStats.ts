/**
 * 战绩统计 Store -- Pinia store，管理玩家历史数据，localStorage 持久化
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MatchResult, PlayerStats } from '@shared/types'

const STORAGE_KEY = 'cricket-battle-stats'

export const usePlayerStatsStore = defineStore('playerStats', () => {
  const stats = ref<PlayerStats>(loadStats())

  function loadStats(): PlayerStats {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        // corrupted data, start fresh
      }
    }
    return createEmptyStats()
  }

  function createEmptyStats(): PlayerStats {
    return {
      playerId: '',
      totalMatches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      bestTime: Infinity,
      currentStreak: 0,
      bestStreak: 0,
      avgResponseTime: 0,
      totalCorrect: 0,
      totalQuestions: 0,
      matchHistory: [],
    }
  }

  function save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats.value))
  }

  function recordMatch(result: MatchResult): void {
    const s = stats.value
    s.totalMatches++
    s.playerId = result.playerId

    if (result.isDraw) {
      s.draws++
      // 平局不中断连胜也不增加连胜
    } else if (result.isWinner) {
      s.wins++
      s.currentStreak++
      s.bestStreak = Math.max(s.bestStreak, s.currentStreak)
    } else {
      s.losses++
      s.currentStreak = 0
    }

    s.winRate = s.wins / s.totalMatches
    s.totalCorrect += result.correctCount
    s.totalQuestions += result.totalQuestions

    if (result.fastestTime > 0 && result.fastestTime < s.bestTime) {
      s.bestTime = result.fastestTime
    }

    // 滚动平均响应时间
    const totalAvgTime = s.avgResponseTime * (s.totalMatches - 1)
    s.avgResponseTime = (totalAvgTime + result.avgResponseTime) / s.totalMatches

    s.matchHistory.unshift(result)
    if (s.matchHistory.length > 100) {
      s.matchHistory = s.matchHistory.slice(0, 100)
    }

    save()
  }

  function getStreak() {
    return {
      current: stats.value.currentStreak,
      best: stats.value.bestStreak,
    }
  }

  function exportData(): string {
    return JSON.stringify(stats.value, null, 2)
  }

  function resetStats(): void {
    stats.value = createEmptyStats()
    save()
  }

  const winRatePercent = computed(() => Math.round(stats.value.winRate * 100))

  return {
    stats,
    winRatePercent,
    recordMatch,
    getStreak,
    exportData,
    resetStats,
  }
})
