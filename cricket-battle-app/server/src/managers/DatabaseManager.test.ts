/**
 * DatabaseManager 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseManager } from './DatabaseManager.js'
import type { MatchResult } from '../../shared/types.js'

describe('DatabaseManager', () => {
  let db: DatabaseManager

  beforeEach(() => {
    db = new DatabaseManager()
  })

  function createMatchResult(overrides: Partial<MatchResult> = {}): MatchResult {
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

  describe('recordMatch', () => {
    it('记录一场比赛不抛异常', () => {
      expect(() => db.recordMatch(createMatchResult())).not.toThrow()
    })

    it('记录多场比赛不抛异常', () => {
      for (let i = 0; i < 5; i++) {
        db.recordMatch(createMatchResult({ timestamp: Date.now() + i }))
      }
      expect(true).toBe(true)
    })
  })

  describe('getPlayerStats', () => {
    it('没有记录时返回零值统计', () => {
      const stats = db.getPlayerStats('nonexistent')
      expect(stats.totalMatches).toBe(0)
      expect(stats.wins).toBe(0)
      expect(stats.winRate).toBe(0)
    })

    it('正确计算胜率', () => {
      db.recordMatch(createMatchResult({ isWinner: true, timestamp: 1000 }))
      db.recordMatch(createMatchResult({ isWinner: false, timestamp: 2000 }))
      db.recordMatch(createMatchResult({ isWinner: true, timestamp: 3000 }))

      const stats = db.getPlayerStats('player1')
      expect(stats.totalMatches).toBe(3)
      expect(stats.wins).toBe(2)
      expect(stats.losses).toBe(1)
      expect(stats.winRate).toBeCloseTo(2 / 3)
    })

    it('正确计算当前连胜', () => {
      db.recordMatch(createMatchResult({ isWinner: true, timestamp: 1000 }))
      db.recordMatch(createMatchResult({ isWinner: true, timestamp: 2000 }))
      db.recordMatch(createMatchResult({ isWinner: false, timestamp: 3000 }))
      db.recordMatch(createMatchResult({ isWinner: true, timestamp: 4000 }))
      db.recordMatch(createMatchResult({ isWinner: true, timestamp: 5000 }))

      const stats = db.getPlayerStats('player1')
      expect(stats.currentStreak).toBe(2)
    })

    it('正确计算最高连胜', () => {
      db.recordMatch(createMatchResult({ isWinner: true, timestamp: 1000 }))
      db.recordMatch(createMatchResult({ isWinner: true, timestamp: 2000 }))
      db.recordMatch(createMatchResult({ isWinner: true, timestamp: 3000 }))
      db.recordMatch(createMatchResult({ isWinner: false, timestamp: 4000 }))
      db.recordMatch(createMatchResult({ isWinner: true, timestamp: 5000 }))

      const stats = db.getPlayerStats('player1')
      expect(stats.bestStreak).toBe(3)
    })

    it('正确计算最佳时间', () => {
      db.recordMatch(createMatchResult({ fastestTime: 1500, timestamp: 1000 }))
      db.recordMatch(createMatchResult({ fastestTime: 800, timestamp: 2000 }))
      db.recordMatch(createMatchResult({ fastestTime: 1200, timestamp: 3000 }))

      const stats = db.getPlayerStats('player1')
      expect(stats.bestTime).toBe(800)
    })

    it('正确计算总正确数', () => {
      db.recordMatch(createMatchResult({ correctCount: 8, timestamp: 1000 }))
      db.recordMatch(createMatchResult({ correctCount: 6, timestamp: 2000 }))

      const stats = db.getPlayerStats('player1')
      expect(stats.totalCorrect).toBe(14)
    })

    it('返回最近的比赛历史', () => {
      for (let i = 0; i < 5; i++) {
        db.recordMatch(createMatchResult({ timestamp: (i + 1) * 1000, score: i * 100 }))
      }

      const stats = db.getPlayerStats('player1')
      expect(stats.matchHistory.length).toBe(5)
      // 按时间倒序
      expect(stats.matchHistory[0].timestamp).toBe(5000)
      expect(stats.matchHistory[4].timestamp).toBe(1000)
    })
  })

  describe('不同玩家数据隔离', () => {
    it('不同 playerId 的数据互不影响', () => {
      db.recordMatch(createMatchResult({ playerId: 'p1', isWinner: true, timestamp: 1000 }))
      db.recordMatch(createMatchResult({ playerId: 'p2', isWinner: false, timestamp: 1000 }))

      const stats1 = db.getPlayerStats('p1')
      const stats2 = db.getPlayerStats('p2')

      expect(stats1.wins).toBe(1)
      expect(stats2.wins).toBe(0)
    })
  })
})
