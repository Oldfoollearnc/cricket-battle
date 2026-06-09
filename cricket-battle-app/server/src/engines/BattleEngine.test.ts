/**
 * BattleEngine 单元测试
 */

import { describe, it, expect } from 'vitest'
import { BattleEngine } from './BattleEngine.js'
import type { DifficultyLevel, Player } from '../../shared/types.js'

describe('BattleEngine', () => {
  const engine = new BattleEngine()

  describe('generateQuestion', () => {
    it('生成的题目包含必要字段', () => {
      const q = engine.generateQuestion('easy', 0)
      expect(q.id).toBeTruthy()
      expect(q.expression).toBeTruthy()
      expect(typeof q.correctAnswer).toBe('number')
      expect(q.difficulty).toBe('easy')
      expect(q.index).toBe(0)
    })

    it('easy 难度只包含加减法', () => {
      for (let i = 0; i < 20; i++) {
        const q = engine.generateQuestion('easy', i)
        expect(q.expression).not.toContain('*')
        expect(q.expression).not.toContain('/')
      }
    })

    it('medium 难度包含乘法', () => {
      const operators = new Set<string>()
      for (let i = 0; i < 100; i++) {
        const q = engine.generateQuestion('medium', i)
        for (const op of ['+', '-', '*']) {
          if (q.expression.includes(` ${op} `)) operators.add(op)
        }
      }
      expect(operators.has('*')).toBe(true)
    })

    it('insane 难度包含除法且结果为整数', () => {
      for (let i = 0; i < 30; i++) {
        const q = engine.generateQuestion('insane', i)
        expect(Number.isInteger(q.correctAnswer)).toBe(true)
      }
    })

    it('生成的题目答案是正确的', () => {
      for (let i = 0; i < 50; i++) {
        const q = engine.generateQuestion('medium', i)
        const calculated = eval(q.expression)
        expect(q.correctAnswer).toBeCloseTo(calculated, 2)
      }
    })
  })

  describe('generateQuestionBatch', () => {
    it('批量生成指定数量的题目', () => {
      const questions = engine.generateQuestionBatch('easy', 10)
      expect(questions.length).toBe(10)
      expect(questions[0].index).toBe(0)
      expect(questions[9].index).toBe(9)
    })

    it('每道题的 id 唯一', () => {
      const questions = engine.generateQuestionBatch('medium', 20)
      const ids = new Set(questions.map((q) => q.id))
      expect(ids.size).toBe(20)
    })
  })

  describe('checkAnswer', () => {
    it('正确答案返回 isCorrect: true', () => {
      const q = engine.generateQuestion('easy', 0)
      const startTime = 1000
      const endTime = 2000
      const serverTimestamp = 900
      const result = engine.checkAnswer(q, q.correctAnswer, startTime, endTime, serverTimestamp, 15000)
      expect(result.isCorrect).toBe(true)
      expect(result.correctAnswer).toBe(q.correctAnswer)
      expect(result.responseTime).toBeGreaterThanOrEqual(200)
      expect(result.serverTimestamp).toBeGreaterThan(0)
    })

    it('错误答案返回 isCorrect: false', () => {
      const q = engine.generateQuestion('easy', 0)
      const result = engine.checkAnswer(q, q.correctAnswer + 999, 1000, 2000, 900, 15000)
      expect(result.isCorrect).toBe(false)
    })

    it('浮点数答案允许小误差', () => {
      const q = { id: 'test', expression: '1 / 3', correctAnswer: 0.33, difficulty: 'easy' as DifficultyLevel, index: 0 }
      const result = engine.checkAnswer(q, 0.33, 1000, 2000, 900, 15000)
      expect(result.isCorrect).toBe(true)
    })

    it('响应时间被限制在服务端 timeLimit 范围内', () => {
      const q = engine.generateQuestion('easy', 0)
      const result = engine.checkAnswer(q, q.correctAnswer, 1000, 20000, 900, 15000)
      expect(result.responseTime).toBeLessThanOrEqual(15000)
    })

    it('响应时间不能为负数', () => {
      const q = engine.generateQuestion('easy', 0)
      const result = engine.checkAnswer(q, q.correctAnswer, 2000, 1000, 900, 15000)
      expect(result.responseTime).toBeGreaterThanOrEqual(200)
    })
  })

  describe('validateClientTimestamp', () => {
    it('正常时间戳通过校验', () => {
      const serverTimestamp = Date.now()
      const clientStartTime = serverTimestamp - 100
      const result = engine.validateClientTimestamp(clientStartTime, serverTimestamp, 15000)
      expect(result.valid).toBe(true)
    })

    it('过早的时间戳被拒绝', () => {
      const serverTimestamp = Date.now()
      const clientStartTime = serverTimestamp - 5000
      const result = engine.validateClientTimestamp(clientStartTime, serverTimestamp, 15000)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('过早')
    })

    it('过晚的时间戳被拒绝', () => {
      const serverTimestamp = Date.now()
      const clientStartTime = serverTimestamp + 5000
      const result = engine.validateClientTimestamp(clientStartTime, serverTimestamp, 15000)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('过晚')
    })

    it('2秒内的时钟漂移被接受', () => {
      const serverTimestamp = Date.now()
      const clientStartTime = serverTimestamp - 1999
      const result = engine.validateClientTimestamp(clientStartTime, serverTimestamp, 15000)
      expect(result.valid).toBe(true)
    })
  })

  describe('recordAnswer', () => {
    it('首次提交被接受', () => {
      const result = engine.recordAnswer('room1', 0, 'player1', 42, 1000)
      expect(result.accepted).toBe(true)
    })

    it('重复提交被拒绝', () => {
      engine.recordAnswer('room1', 0, 'player1', 42, 1000)
      const result = engine.recordAnswer('room1', 0, 'player1', 42, 1000)
      expect(result.accepted).toBe(false)
    })

    it('不同玩家同一题可以提交', () => {
      engine.recordAnswer('room1', 0, 'player1', 42, 1000)
      const result = engine.recordAnswer('room1', 0, 'player2', 42, 1000)
      expect(result.accepted).toBe(true)
    })

    it('同一玩家不同题可以提交', () => {
      engine.recordAnswer('room1', 0, 'player1', 42, 1000)
      const result = engine.recordAnswer('room1', 1, 'player1', 42, 1000)
      expect(result.accepted).toBe(true)
    })

    it('不同房间互不影响', () => {
      engine.recordAnswer('room1', 0, 'player1', 42, 1000)
      const result = engine.recordAnswer('room2', 0, 'player1', 42, 1000)
      expect(result.accepted).toBe(true)
    })
  })

  describe('haveAllPlayersAnswered', () => {
    it('所有玩家都提交后返回 true', () => {
      engine.recordAnswer('room_check', 0, 'p1', 10, 1000)
      engine.recordAnswer('room_check', 0, 'p2', 20, 1500)
      const result = engine.haveAllPlayersAnswered('room_check', 0, ['p1', 'p2'])
      expect(result).toBe(true)
    })

    it('部分玩家未提交时返回 false', () => {
      engine.recordAnswer('room_partial', 0, 'p1', 10, 1000)
      const result = engine.haveAllPlayersAnswered('room_partial', 0, ['p1', 'p2'])
      expect(result).toBe(false)
    })

    it('无提交记录时返回 false', () => {
      const result = engine.haveAllPlayersAnswered('room_empty', 0, ['p1'])
      expect(result).toBe(false)
    })
  })

  describe('clearRoomSubmissions', () => {
    it('清除后同一玩家可以再次提交', () => {
      engine.recordAnswer('room1', 0, 'player1', 42, 1000)
      engine.clearRoomSubmissions('room1')
      const result = engine.recordAnswer('room1', 0, 'player1', 42, 1000)
      expect(result.accepted).toBe(true)
    })

    it('只清除指定房间', () => {
      engine.recordAnswer('room1', 0, 'player1', 42, 1000)
      engine.recordAnswer('room2', 0, 'player1', 42, 1000)
      engine.clearRoomSubmissions('room1')
      const result = engine.recordAnswer('room2', 0, 'player1', 42, 1000)
      expect(result.accepted).toBe(false)
    })
  })

  describe('calculateRanking', () => {
    it('按分数降序排列', () => {
      const players: Player[] = [
        { id: 'p1', name: 'Alice', isReady: true, isConnected: true, score: 100, correctCount: 2, totalResponseTime: 3000, totalAllResponseTime: 5000, fastestCorrectTime: 1000 },
        { id: 'p2', name: 'Bob', isReady: true, isConnected: true, score: 200, correctCount: 3, totalResponseTime: 4000, totalAllResponseTime: 7000, fastestCorrectTime: 800 },
        { id: 'p3', name: 'Charlie', isReady: true, isConnected: true, score: 150, correctCount: 2, totalResponseTime: 2000, totalAllResponseTime: 4000, fastestCorrectTime: 900 },
      ]
      const rankings = engine.calculateRanking(players)
      expect(rankings[0].playerId).toBe('p2')
      expect(rankings[0].rank).toBe(1)
      expect(rankings[1].playerId).toBe('p3')
      expect(rankings[1].rank).toBe(2)
      expect(rankings[2].playerId).toBe('p1')
      expect(rankings[2].rank).toBe(3)
    })

    it('分数相同时按正确数排序', () => {
      const players: Player[] = [
        { id: 'p1', name: 'Alice', isReady: true, isConnected: true, score: 100, correctCount: 1, totalResponseTime: 1000, totalAllResponseTime: 3000, fastestCorrectTime: 1000 },
        { id: 'p2', name: 'Bob', isReady: true, isConnected: true, score: 100, correctCount: 3, totalResponseTime: 5000, totalAllResponseTime: 8000, fastestCorrectTime: 1200 },
      ]
      const rankings = engine.calculateRanking(players)
      expect(rankings[0].playerId).toBe('p2')
    })

    it('分数和正确数都相同时按响应时间排序', () => {
      const players: Player[] = [
        { id: 'p1', name: 'Alice', isReady: true, isConnected: true, score: 100, correctCount: 2, totalResponseTime: 5000, totalAllResponseTime: 7000, fastestCorrectTime: 2000 },
        { id: 'p2', name: 'Bob', isReady: true, isConnected: true, score: 100, correctCount: 2, totalResponseTime: 2000, totalAllResponseTime: 5000, fastestCorrectTime: 800 },
      ]
      const rankings = engine.calculateRanking(players)
      expect(rankings[0].playerId).toBe('p2')
    })
  })
})
