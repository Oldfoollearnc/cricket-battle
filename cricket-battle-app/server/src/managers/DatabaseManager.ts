/**
 * 数据库管理器 -- 内存存储 + JSON 文件持久化玩家战绩
 * 不使用 native 依赖，纯 TypeScript 实现
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname } from 'path'
import { mkdirSync } from 'fs'
import type { MatchResult, PlayerStats } from '../../shared/types.js'

export class DatabaseManager {
  private store = new Map<string, MatchResult[]>()
  private filePath: string | null

  constructor(filePath?: string) {
    this.filePath = filePath ?? null
    if (this.filePath && existsSync(this.filePath)) {
      try {
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'))
        for (const [playerId, matches] of Object.entries(data)) {
          this.store.set(playerId, matches as MatchResult[])
        }
      } catch {
        // corrupted file, start fresh
      }
    }
  }

  recordMatch(result: MatchResult): void {
    const existing = this.store.get(result.playerId) ?? []
    existing.push(result)
    this.store.set(result.playerId, existing)
    this.persist()
  }

  getPlayerStats(playerId: string): PlayerStats {
    const matches = this.store.get(playerId) ?? []

    if (matches.length === 0) {
      return {
        playerId,
        totalMatches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        bestTime: 0,
        currentStreak: 0,
        bestStreak: 0,
        avgResponseTime: 0,
        totalCorrect: 0,
        totalQuestions: 0,
        matchHistory: [],
      }
    }

    const wins = matches.filter((m) => m.isWinner).length
    const draws = matches.filter((m) => m.isDraw).length
    const totalCorrect = matches.reduce((sum, m) => sum + m.correctCount, 0)
    const totalQuestions = matches.reduce((sum, m) => sum + m.totalQuestions, 0)
    const totalAvgTime = matches.reduce((sum, m) => sum + m.avgResponseTime, 0)
    const fastestTimes = matches.map((m) => m.fastestTime).filter((t) => t > 0)
    const bestTime = fastestTimes.length > 0 ? Math.min(...fastestTimes) : 0

    const { currentStreak, bestStreak } = this.calculateStreaks(matches)

    const matchHistory = [...matches].sort((a, b) => b.timestamp - a.timestamp)

    return {
      playerId,
      totalMatches: matches.length,
      wins,
      losses: matches.length - wins - draws,
      draws,
      winRate: wins / matches.length,
      bestTime,
      currentStreak,
      bestStreak,
      avgResponseTime: totalAvgTime / matches.length,
      totalCorrect,
      totalQuestions,
      matchHistory,
    }
  }

  private calculateStreaks(matches: MatchResult[]): { currentStreak: number; bestStreak: number } {
    const sorted = [...matches].sort((a, b) => a.timestamp - b.timestamp)

    let bestStreak = 0
    let tempStreak = 0

    for (const m of sorted) {
      if (m.isWinner) {
        tempStreak++
        bestStreak = Math.max(bestStreak, tempStreak)
      } else {
        tempStreak = 0
      }
    }

    // 当前连胜从最新记录往回数
    let currentStreak = 0
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].isWinner) {
        currentStreak++
      } else {
        break
      }
    }

    return { currentStreak, bestStreak }
  }

  private persist(): void {
    if (!this.filePath) return
    try {
      const dir = dirname(this.filePath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      const data: Record<string, MatchResult[]> = {}
      for (const [key, value] of this.store.entries()) {
        data[key] = value
      }
      writeFileSync(this.filePath, JSON.stringify(data, null, 2))
    } catch {
      // 持久化失败不影响正常功能
    }
  }
}
