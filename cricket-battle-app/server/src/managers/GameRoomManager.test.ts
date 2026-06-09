/**
 * GameRoomManager 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { GameRoomManager, DEFAULT_CONFIG, createPlayer } from './GameRoomManager.js'
import { BattleEngine } from '../engines/BattleEngine.js'

describe('GameRoomManager', () => {
  let manager: GameRoomManager

  beforeEach(() => {
    manager = new GameRoomManager(new BattleEngine())
  })

  describe('createRoom', () => {
    it('创建房间返回正确结构', () => {
      const room = manager.createRoom('host1', 'Host', { maxPlayers: 2 })
      expect(room.id).toBeTruthy()
      expect(room.hostId).toBe('host1')
      expect(room.players.length).toBe(1)
      expect(room.players[0].name).toBe('Host')
      expect(room.status).toBe('waiting')
      expect(room.config.maxPlayers).toBe(2)
    })

    it('使用默认配置填充缺失字段', () => {
      const room = manager.createRoom('host1', 'Host')
      expect(room.config.maxPlayers).toBe(DEFAULT_CONFIG.maxPlayers)
      expect(room.config.difficulty).toBe(DEFAULT_CONFIG.difficulty)
      expect(room.config.questionCount).toBe(DEFAULT_CONFIG.questionCount)
      expect(room.config.timeLimit).toBe(DEFAULT_CONFIG.timeLimit)
    })

    it('房间 ID 是 6 位大写字母数字', () => {
      const room = manager.createRoom('host1', 'Host')
      expect(room.id).toMatch(/^[A-Z0-9]{6}$/)
    })

    it('多个房间 ID 不重复', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 50; i++) {
        const room = manager.createRoom(`host${i}`, `Host${i}`)
        ids.add(room.id)
      }
      expect(ids.size).toBe(50)
    })
  })

  describe('joinRoom', () => {
    it('玩家可以加入房间', () => {
      const room = manager.createRoom('host1', 'Host')
      const joined = manager.joinRoom(room.id, 'player1', 'Player1')
      expect(joined.players.length).toBe(2)
      expect(joined.players[1].name).toBe('Player1')
    })

    it('房间已满时抛出错误', () => {
      const room = manager.createRoom('host1', 'Host', { maxPlayers: 2 })
      manager.joinRoom(room.id, 'p1', 'P1')
      expect(() => manager.joinRoom(room.id, 'p2', 'P2')).toThrow('房间已满')
    })

    it('对战已开始时无法加入', () => {
      const room = manager.createRoom('host1', 'Host')
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)
      expect(() => manager.joinRoom(room.id, 'p2', 'P2')).toThrow('对战已开始')
    })

    it('重复加入抛出错误', () => {
      const room = manager.createRoom('host1', 'Host')
      expect(() => manager.joinRoom(room.id, 'host1', 'Host')).toThrow('已在房间中')
    })

    it('加入不存在的房间抛出错误', () => {
      expect(() => manager.joinRoom('FAKE', 'p1', 'P1')).toThrow('房间不存在')
    })
  })

  describe('leaveRoom', () => {
    it('玩家离开后从列表移除', () => {
      const room = manager.createRoom('host1', 'Host')
      manager.joinRoom(room.id, 'p1', 'P1')
      const updated = manager.leaveRoom(room.id, 'p1')
      expect(updated!.players.length).toBe(1)
      expect(updated!.players.find((p) => p.id === 'p1')).toBeUndefined()
    })

    it('最后一个玩家离开后房间被清理', () => {
      const room = manager.createRoom('host1', 'Host')
      const result = manager.leaveRoom(room.id, 'host1')
      expect(result).toBeNull()
      expect(manager.getRoom(room.id)).toBeNull()
    })

    it('房主离开后新房主自动指定', () => {
      const room = manager.createRoom('host1', 'Host')
      manager.joinRoom(room.id, 'p1', 'P1')
      const updated = manager.leaveRoom(room.id, 'host1')
      expect(updated!.hostId).toBe('p1')
    })
  })

  describe('toggleReady', () => {
    it('切换准备状态', () => {
      const room = manager.createRoom('host1', 'Host')
      expect(room.players[0].isReady).toBe(false)
      manager.toggleReady(room.id, 'host1')
      const updated = manager.getRoom(room.id)
      expect(updated!.players[0].isReady).toBe(true)
    })
  })

  describe('startBattle', () => {
    it('所有玩家准备后可以开始对战', () => {
      const room = manager.createRoom('host1', 'Host')
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')

      const state = manager.startBattle(room.id)
      expect(state.status).toBe('battling')
      expect(state.currentQuestion).toBeTruthy()
      expect(state.totalQuestions).toBe(room.config.questionCount)
    })

    it('人数不足时无法开始', () => {
      const room = manager.createRoom('host1', 'Host')
      manager.toggleReady(room.id, 'host1')
      expect(() => manager.startBattle(room.id)).toThrow('人数不足')
    })

    it('有玩家未准备时无法开始', () => {
      const room = manager.createRoom('host1', 'Host')
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      expect(() => manager.startBattle(room.id)).toThrow('未准备')
    })

    it('开始对战时重置玩家分数', () => {
      const room = manager.createRoom('host1', 'Host')
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)

      const updated = manager.getRoom(room.id)
      for (const p of updated!.players) {
        expect(p.score).toBe(0)
        expect(p.correctCount).toBe(0)
        expect(p.totalResponseTime).toBe(0)
        expect(p.totalAllResponseTime).toBe(0)
        expect(p.fastestCorrectTime).toBe(Infinity)
      }
    })
  })

  describe('recordAnswer', () => {
    it('记录正确答案并加分', () => {
      const room = manager.createRoom('host1', 'Host')
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)

      const question = manager.getCurrentQuestion(room.id)!
      const now = Date.now()
      const { accepted, result } = manager.recordAnswer(
        room.id, 'host1', 0, question.correctAnswer, now - 2000, now,
      )
      expect(accepted).toBe(true)
      expect(result!.isCorrect).toBe(true)

      const updated = manager.getRoom(room.id)
      const player = updated!.players.find((p) => p.id === 'host1')!
      expect(player.score).toBeGreaterThan(0)
      expect(player.correctCount).toBe(1)
    })

    it('记录错误答案不加分', () => {
      const room = manager.createRoom('host1', 'Host')
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)

      const question = manager.getCurrentQuestion(room.id)!
      const now = Date.now()
      const { accepted, result } = manager.recordAnswer(
        room.id, 'host1', 0, question.correctAnswer + 999, now - 2000, now,
      )
      expect(accepted).toBe(true)
      expect(result!.isCorrect).toBe(false)

      const updated = manager.getRoom(room.id)
      const player = updated!.players.find((p) => p.id === 'host1')!
      expect(player.score).toBe(0)
    })

    it('重复提交同一题被拒绝', () => {
      const room = manager.createRoom('host1', 'Host')
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)

      const question = manager.getCurrentQuestion(room.id)!
      const now = Date.now()

      const first = manager.recordAnswer(room.id, 'host1', 0, question.correctAnswer, now - 1000, now)
      expect(first.accepted).toBe(true)

      const second = manager.recordAnswer(room.id, 'host1', 0, question.correctAnswer, now - 1000, now)
      expect(second.accepted).toBe(false)
    })

    it('不同玩家可以提交同一题', () => {
      const room = manager.createRoom('host1', 'Host')
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)

      const question = manager.getCurrentQuestion(room.id)!
      const now = Date.now()

      const first = manager.recordAnswer(room.id, 'host1', 0, question.correctAnswer, now - 1000, now)
      expect(first.accepted).toBe(true)

      const second = manager.recordAnswer(room.id, 'p1', 0, question.correctAnswer, now - 500, now)
      expect(second.accepted).toBe(true)
    })

    it('正确答案更新 fastestCorrectTime', () => {
      const room = manager.createRoom('host1', 'Host')
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)

      const question = manager.getCurrentQuestion(room.id)!
      const now = Date.now()

      manager.recordAnswer(room.id, 'host1', 0, question.correctAnswer, now - 3000, now)

      const updated = manager.getRoom(room.id)
      const player = updated!.players.find((p) => p.id === 'host1')!
      expect(player.fastestCorrectTime).toBeGreaterThanOrEqual(200)
      expect(player.fastestCorrectTime).toBeLessThanOrEqual(3000)
    })

    it('totalResponseTime 只累加正确答案的响应时间', () => {
      const room = manager.createRoom('host1', 'Host')
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)

      const question = manager.getCurrentQuestion(room.id)!
      const now = Date.now()

      // 第一题答对
      manager.recordAnswer(room.id, 'host1', 0, question.correctAnswer, now - 2000, now)

      // 推进到下一题并答错
      manager.advanceQuestion(room.id)
      const q2 = manager.getCurrentQuestion(room.id)!
      manager.recordAnswer(room.id, 'host1', 1, q2.correctAnswer + 999, now - 1000, now)

      const updated = manager.getRoom(room.id)
      const player = updated!.players.find((p) => p.id === 'host1')!

      // totalResponseTime 只累加正确答案
      expect(player.totalResponseTime).toBeGreaterThanOrEqual(200)
      expect(player.totalResponseTime).toBeLessThanOrEqual(2000)
      // totalAllResponseTime 累加所有作答
      expect(player.totalAllResponseTime).toBeGreaterThanOrEqual(400)
    })
  })

  describe('advanceQuestion', () => {
    it('推进到下一题', () => {
      const room = manager.createRoom('host1', 'Host', { questionCount: 3 })
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)

      const q1 = manager.advanceQuestion(room.id)
      expect(q1).toBeTruthy()
      expect(q1!.index).toBe(1)

      const q2 = manager.advanceQuestion(room.id)
      expect(q2).toBeTruthy()
      expect(q2!.index).toBe(2)
    })

    it('最后一题后对战结束', () => {
      const room = manager.createRoom('host1', 'Host', { questionCount: 2 })
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)

      manager.advanceQuestion(room.id)
      const result = manager.advanceQuestion(room.id)
      expect(result).toBeNull()

      const updated = manager.getRoom(room.id)
      expect(updated!.status).toBe('finished')
    })
  })

  describe('handleDisconnect / handleReconnect', () => {
    it('断线后玩家标记为离线', () => {
      const room = manager.createRoom('host1', 'Host')
      manager.handleDisconnect(room.id, 'host1')
      const updated = manager.getRoom(room.id)
      expect(updated!.players[0].isConnected).toBe(false)
    })

    it('重连后玩家恢复在线', () => {
      const room = manager.createRoom('host1', 'Host')
      manager.handleDisconnect(room.id, 'host1')
      manager.handleReconnect(room.id, 'host1')
      const updated = manager.getRoom(room.id)
      expect(updated!.players[0].isConnected).toBe(true)
    })
  })

  describe('getPlayerResults', () => {
    it('对战结束后返回所有玩家结果', () => {
      const room = manager.createRoom('host1', 'Host', { questionCount: 2 })
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)

      manager.advanceQuestion(room.id)
      manager.advanceQuestion(room.id)

      const results = manager.getPlayerResults(room.id)
      expect(results.length).toBe(2)
      expect(results[0].playerId).toBeTruthy()
      expect(typeof results[0].score).toBe('number')
    })

    it('fastestTime 来自实际最快正确答题', () => {
      const room = manager.createRoom('host1', 'Host', { questionCount: 2 })
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)

      const q1 = manager.getCurrentQuestion(room.id)!
      const now = Date.now()
      manager.recordAnswer(room.id, 'host1', 0, q1.correctAnswer, now - 1500, now)

      manager.advanceQuestion(room.id)
      const q2 = manager.getCurrentQuestion(room.id)!
      manager.recordAnswer(room.id, 'host1', 1, q2.correctAnswer, now - 800, now)

      manager.advanceQuestion(room.id)

      const results = manager.getPlayerResults(room.id)
      const hostResult = results.find((r) => r.playerId === 'host1')!
      expect(hostResult.fastestTime).toBeGreaterThanOrEqual(200)
      expect(hostResult.fastestTime).toBeLessThanOrEqual(1500)
    })
  })

  describe('getPlayerResults 平局检测', () => {
    it('多人同分时 isWinner 全部为 false', () => {
      const room = manager.createRoom('host1', 'Host', { questionCount: 1 })
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)

      const question = manager.getCurrentQuestion(room.id)!
      const now = Date.now()

      // 两人都答对，分数相同
      manager.recordAnswer(room.id, 'host1', 0, question.correctAnswer, now - 1000, now)
      manager.recordAnswer(room.id, 'p1', 0, question.correctAnswer, now - 500, now)

      manager.advanceQuestion(room.id)

      const results = manager.getPlayerResults(room.id)
      expect(results.every((r) => !r.isWinner)).toBe(true)
    })

    it('平局时 isDraw 为 true', () => {
      const room = manager.createRoom('host1', 'Host', { questionCount: 1 })
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)

      const question = manager.getCurrentQuestion(room.id)!
      const now = Date.now()

      manager.recordAnswer(room.id, 'host1', 0, question.correctAnswer, now - 1000, now)
      manager.recordAnswer(room.id, 'p1', 0, question.correctAnswer, now - 500, now)

      manager.advanceQuestion(room.id)

      const results = manager.getPlayerResults(room.id)
      expect(results.every((r) => r.isDraw)).toBe(true)
    })

    it('非平局时 isDraw 为 false', () => {
      const room = manager.createRoom('host1', 'Host', { questionCount: 2 })
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)

      const q1 = manager.getCurrentQuestion(room.id)!
      const now = Date.now()
      manager.recordAnswer(room.id, 'host1', 0, q1.correctAnswer, now - 1000, now)

      manager.advanceQuestion(room.id)
      const q2 = manager.getCurrentQuestion(room.id)!
      manager.recordAnswer(room.id, 'host1', 1, q2.correctAnswer, now - 800, now)
      manager.recordAnswer(room.id, 'p1', 1, q2.correctAnswer, now - 500, now)

      manager.advanceQuestion(room.id)

      const results = manager.getPlayerResults(room.id)
      expect(results.every((r) => !r.isDraw)).toBe(true)
    })

    it('唯一最高分时 isWinner 为 true', () => {
      const room = manager.createRoom('host1', 'Host', { questionCount: 2 })
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)

      const q1 = manager.getCurrentQuestion(room.id)!
      const now = Date.now()

      // host1 答对第一题
      manager.recordAnswer(room.id, 'host1', 0, q1.correctAnswer, now - 1000, now)

      manager.advanceQuestion(room.id)
      const q2 = manager.getCurrentQuestion(room.id)!

      // 两人都答对第二题
      manager.recordAnswer(room.id, 'host1', 1, q2.correctAnswer, now - 800, now)
      manager.recordAnswer(room.id, 'p1', 1, q2.correctAnswer, now - 500, now)

      manager.advanceQuestion(room.id)

      const results = manager.getPlayerResults(room.id)
      const hostResult = results.find((r) => r.playerId === 'host1')!
      const p1Result = results.find((r) => r.playerId === 'p1')!
      expect(hostResult.isWinner).toBe(true)
      expect(p1Result.isWinner).toBe(false)
    })
  })

  describe('createSoloPractice', () => {
    it('创建单人练习直接进入对战', () => {
      const state = manager.createSoloPractice('solo1', 'SoloPlayer')
      expect(state.status).toBe('battling')
      expect(state.currentQuestion).toBeTruthy()
      expect(state.players.length).toBe(1)
      expect(state.players[0].name).toBe('SoloPlayer')
    })

    it('单人练习使用指定难度和题数', () => {
      const state = manager.createSoloPractice('solo2', 'Solo', { difficulty: 'hard', questionCount: 5 })
      expect(state.totalQuestions).toBe(5)
      const room = manager.getRoom(state.roomId)
      expect(room!.config.difficulty).toBe('hard')
    })

    it('单人练习房间 maxPlayers 为 1', () => {
      const state = manager.createSoloPractice('solo3', 'Solo')
      const room = manager.getRoom(state.roomId)
      expect(room!.config.maxPlayers).toBe(1)
    })
  })

  describe('restartBattle', () => {
    it('再来一局重置所有玩家分数并自动准备', () => {
      const room = manager.createRoom('host1', 'Host', { questionCount: 2 })
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)

      // 模拟打完一局
      const q1 = manager.getCurrentQuestion(room.id)!
      const now = Date.now()
      manager.recordAnswer(room.id, 'host1', 0, q1.correctAnswer, now - 1000, now)
      manager.advanceQuestion(room.id)
      manager.advanceQuestion(room.id)

      const state = manager.restartBattle(room.id)
      expect(state.status).toBe('battling')
      expect(state.currentQuestion).toBeTruthy()

      const updated = manager.getRoom(room.id)
      for (const p of updated!.players) {
        expect(p.score).toBe(0)
        expect(p.isReady).toBe(true)
      }
    })

    it('再来一局使用相同房间配置', () => {
      const room = manager.createRoom('host1', 'Host', { questionCount: 5, difficulty: 'hard' })
      manager.joinRoom(room.id, 'p1', 'P1')
      manager.toggleReady(room.id, 'host1')
      manager.toggleReady(room.id, 'p1')
      manager.startBattle(room.id)

      manager.advanceQuestion(room.id)
      manager.advanceQuestion(room.id)
      manager.advanceQuestion(room.id)
      manager.advanceQuestion(room.id)
      manager.advanceQuestion(room.id)

      const state = manager.restartBattle(room.id)
      expect(state.totalQuestions).toBe(5)

      const updated = manager.getRoom(room.id)
      expect(updated!.config.difficulty).toBe('hard')
      expect(updated!.config.questionCount).toBe(5)
    })
  })

  describe('createPlayer', () => {
    it('创建玩家包含所有必要字段', () => {
      const player = createPlayer('id1', 'TestPlayer')
      expect(player.id).toBe('id1')
      expect(player.name).toBe('TestPlayer')
      expect(player.isReady).toBe(false)
      expect(player.isConnected).toBe(true)
      expect(player.score).toBe(0)
      expect(player.correctCount).toBe(0)
      expect(player.totalResponseTime).toBe(0)
      expect(player.totalAllResponseTime).toBe(0)
      expect(player.fastestCorrectTime).toBe(Infinity)
    })
  })
})
