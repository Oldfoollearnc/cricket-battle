/**
 * 房间管理器 -- 创建/加入/退出房间，管理房间生命周期
 */

import { v4 as uuidv4 } from 'uuid'
import { BattleEngine } from '../engines/BattleEngine.js'
import type {
  Room, RoomConfig, Player, BattleState,
  Question, AnswerResult, MatchResult,
} from '../../shared/types.js'

export const DEFAULT_CONFIG: RoomConfig = {
  maxPlayers: 4,
  difficulty: 'easy',
  questionCount: 10,
  timeLimit: 15,
}

export const SOLO_PRACTICE_CONFIG: RoomConfig = {
  maxPlayers: 1,
  difficulty: 'easy',
  questionCount: 10,
  timeLimit: 15,
}

const RECONNECT_TIMEOUT_MS = 30_000
const ROOM_ID_MAX_RETRIES = 10
const ROOM_EXPIRE_MS = 5 * 60 * 1000

export function createPlayer(id: string, name: string): Player {
  return {
    id,
    name,
    isReady: false,
    isConnected: true,
    score: 0,
    correctCount: 0,
    totalResponseTime: 0,
    totalAllResponseTime: 0,
    fastestCorrectTime: Infinity,
  }
}

export class GameRoomManager {
  private rooms = new Map<string, Room>()
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private roomExpireTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private battleEngine: BattleEngine

  constructor(battleEngine?: BattleEngine) {
    this.battleEngine = battleEngine ?? new BattleEngine()
  }

  createRoom(hostId: string, hostName: string, config: Partial<RoomConfig> = {}): Room {
    const fullConfig: RoomConfig = { ...DEFAULT_CONFIG, ...config }

    let roomId = ''
    for (let i = 0; i < ROOM_ID_MAX_RETRIES; i++) {
      const candidate = uuidv4().slice(0, 6).toUpperCase()
      if (!this.rooms.has(candidate)) {
        roomId = candidate
        break
      }
    }
    if (!roomId) {
      throw new Error('无法生成唯一房间ID，请重试')
    }

    const room: Room = {
      id: roomId,
      hostId,
      players: [createPlayer(hostId, hostName)],
      config: fullConfig,
      status: 'waiting',
      currentQuestionIndex: -1,
      questions: [],
      createdAt: Date.now(),
    }
    this.rooms.set(room.id, room)
    return room
  }

  /**
   * 创建单人练习房间并直接开始对战
   */
  createSoloPractice(playerId: string, playerName: string, config: Partial<RoomConfig> = {}): BattleState {
    const fullConfig: RoomConfig = { ...SOLO_PRACTICE_CONFIG, ...config, maxPlayers: 1 }

    let roomId = ''
    for (let i = 0; i < ROOM_ID_MAX_RETRIES; i++) {
      const candidate = uuidv4().slice(0, 6).toUpperCase()
      if (!this.rooms.has(candidate)) {
        roomId = candidate
        break
      }
    }
    if (!roomId) {
      throw new Error('无法生成唯一房间ID，请重试')
    }

    const player = createPlayer(playerId, playerName)
    player.isReady = true

    const room: Room = {
      id: roomId,
      hostId: playerId,
      players: [player],
      config: fullConfig,
      status: 'waiting',
      currentQuestionIndex: -1,
      questions: [],
      createdAt: Date.now(),
    }
    this.rooms.set(room.id, room)

    // 直接开始对战
    return this.startBattle(roomId)
  }

  joinRoom(roomId: string, playerId: string, playerName: string): Room {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error('房间不存在')
    if (room.status !== 'waiting') throw new Error('对战已开始，无法加入')
    if (room.players.length >= room.config.maxPlayers) throw new Error('房间已满')
    if (room.players.some((p) => p.id === playerId)) throw new Error('已在房间中')

    room.players.push(createPlayer(playerId, playerName))

    return room
  }

  leaveRoom(roomId: string, playerId: string): Room | null {
    const room = this.rooms.get(roomId)
    if (!room) return null

    room.players = room.players.filter((p) => p.id !== playerId)

    if (room.players.length === 0) {
      this.cleanupRoom(roomId)
      return null
    }

    if (room.hostId === playerId) {
      room.hostId = room.players[0].id
    }

    return room
  }

  toggleReady(roomId: string, playerId: string): Room {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error('房间不存在')

    const player = room.players.find((p) => p.id === playerId)
    if (!player) throw new Error('玩家不在房间中')

    player.isReady = !player.isReady
    return room
  }

  canStartBattle(roomId: string): boolean {
    const room = this.rooms.get(roomId)
    if (!room) return false
    // 单人练习模式允许 1 人开始
    if (room.config.maxPlayers === 1) {
      return room.players.length >= 1 && room.players.every((p) => p.isReady)
    }
    if (room.players.length < 2) return false
    return room.players.every((p) => p.isReady)
  }

  startBattle(roomId: string): BattleState {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error('房间不存在')
    if (!this.canStartBattle(roomId)) throw new Error('无法开始对战：人数不足或有玩家未准备')

    room.questions = this.battleEngine.generateQuestionBatch(
      room.config.difficulty,
      room.config.questionCount,
    )
    room.currentQuestionIndex = 0
    room.status = 'battling'

    room.players.forEach((p) => {
      p.score = 0
      p.correctCount = 0
      p.totalResponseTime = 0
      p.totalAllResponseTime = 0
      p.fastestCorrectTime = Infinity
    })

    this.battleEngine.clearRoomSubmissions(roomId)

    return this.getBattleState(roomId)
  }

  /**
   * 再来一局：重置房间状态，所有玩家自动准备，返回可直接开始的状态
   */
  restartBattle(roomId: string): BattleState {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error('房间不存在')

    // 回到 waiting 状态
    room.status = 'waiting'

    // 所有在线玩家自动准备
    room.players.forEach((p) => {
      p.isReady = true
      p.score = 0
      p.correctCount = 0
      p.totalResponseTime = 0
      p.totalAllResponseTime = 0
      p.fastestCorrectTime = Infinity
    })

    room.currentQuestionIndex = -1
    room.questions = []
    this.battleEngine.clearRoomSubmissions(roomId)

    // 直接开始新对战
    return this.startBattle(roomId)
  }

  getCurrentQuestion(roomId: string): Question | null {
    const room = this.rooms.get(roomId)
    if (!room || room.status !== 'battling') return null
    return room.questions[room.currentQuestionIndex] ?? null
  }

  recordAnswer(
    roomId: string,
    playerId: string,
    questionIndex: number,
    answer: number,
    clientStartTime: number,
    clientEndTime: number,
  ): { accepted: boolean; result?: AnswerResult } {
    const room = this.rooms.get(roomId)
    if (!room || room.status !== 'battling') throw new Error('对战未进行')

    const question = room.questions[questionIndex]
    if (!question) throw new Error('当前没有题目')

    // questionIndex 校验
    if (questionIndex !== room.currentQuestionIndex) {
      throw new Error('题目序号不匹配')
    }

    // 委托 BattleEngine 做重复提交检测
    const submissionCheck = this.battleEngine.recordAnswer(roomId, questionIndex, playerId, answer, 0)
    if (!submissionCheck.accepted) {
      return { accepted: false }
    }

    const timeLimitMs = room.config.timeLimit * 1000
    const serverTimestamp = Date.now()
    const result = this.battleEngine.checkAnswer(
      question, answer, clientStartTime, clientEndTime, serverTimestamp, timeLimitMs,
    )

    const player = room.players.find((p) => p.id === playerId)
    if (player) {
      player.totalAllResponseTime += result.responseTime

      if (result.isCorrect) {
        const speedBonus = Math.max(0, Math.floor((timeLimitMs - result.responseTime) / 100))
        player.score += 100 + speedBonus
        player.correctCount++
        player.totalResponseTime += result.responseTime
        if (result.responseTime < player.fastestCorrectTime) {
          player.fastestCorrectTime = result.responseTime
        }
      }
    }

    return { accepted: true, result }
  }

  advanceQuestion(roomId: string): Question | null {
    const room = this.rooms.get(roomId)
    if (!room) return null

    room.currentQuestionIndex++
    if (room.currentQuestionIndex >= room.questions.length) {
      room.status = 'finished'
      return null
    }

    return room.questions[room.currentQuestionIndex]
  }

  /**
   * 检查所有在线玩家是否都已答完当前题目
   * 用于实现"答完即切换下一题"
   */
  haveAllPlayersAnswered(roomId: string): boolean {
    const room = this.rooms.get(roomId)
    if (!room || room.status !== 'battling') return false

    const connectedPlayerIds = room.players
      .filter((p) => p.isConnected)
      .map((p) => p.id)

    if (connectedPlayerIds.length === 0) return false

    return this.battleEngine.haveAllPlayersAnswered(
      roomId, room.currentQuestionIndex, connectedPlayerIds,
    )
  }

  getBattleState(roomId: string): BattleState {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error('房间不存在')

    const currentQuestion = room.questions[room.currentQuestionIndex] ?? null
    const rankings = this.battleEngine.calculateRanking(room.players)

    return {
      roomId: room.id,
      status: room.status,
      currentQuestion,
      questionIndex: room.currentQuestionIndex,
      totalQuestions: room.questions.length,
      timeRemaining: room.config.timeLimit,
      timeLimit: room.config.timeLimit,
      rankings,
      players: [...room.players],
      serverTimestamp: Date.now(),
    }
  }

  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) ?? null
  }

  getRooms(): Room[] {
    return Array.from(this.rooms.values())
  }

  getPlayerResults(roomId: string): MatchResult[] {
    const room = this.rooms.get(roomId)
    if (!room) return []

    const rankings = this.battleEngine.calculateRanking(room.players)
    const topScore = rankings[0]?.score ?? 0

    // 平局检测：多人并列最高分时无人获胜
    const topScorers = room.players.filter((p) => p.score === topScore)
    const isDraw = topScorers.length > 1

    const now = Date.now()

    return room.players.map((p) => {
      return {
        playerId: p.id,
        playerName: p.name,
        isWinner: !isDraw && p.score === topScore,
        isDraw,
        score: p.score,
        correctCount: p.correctCount,
        totalQuestions: room.questions.length,
        avgResponseTime: p.correctCount > 0 ? p.totalResponseTime / p.correctCount : 0,
        fastestTime: p.fastestCorrectTime === Infinity ? 0 : p.fastestCorrectTime,
        duration: now - room.createdAt,
        timestamp: now,
        opponentCount: room.players.length - 1,
      }
    })
  }

  handleDisconnect(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    const player = room.players.find((p) => p.id === playerId)
    if (player) player.isConnected = false

    const key = `${roomId}:${playerId}`
    const timer = setTimeout(() => {
      this.leaveRoom(roomId, playerId)
      this.reconnectTimers.delete(key)
    }, RECONNECT_TIMEOUT_MS)

    this.reconnectTimers.set(key, timer)
  }

  handleReconnect(roomId: string, playerId: string): Room | null {
    const room = this.rooms.get(roomId)
    if (!room) return null

    const player = room.players.find((p) => p.id === playerId)
    if (!player) return null

    player.isConnected = true

    const key = `${roomId}:${playerId}`
    const timer = this.reconnectTimers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.reconnectTimers.delete(key)
    }

    return room
  }

  setRoomExpireTimer(roomId: string, onExpire: () => void): void {
    const timer = setTimeout(() => {
      const room = this.rooms.get(roomId)
      if (room && room.status === 'finished') {
        room.status = 'expired'
      }
      this.roomExpireTimers.delete(roomId)
      onExpire()
    }, ROOM_EXPIRE_MS)
    this.roomExpireTimers.set(roomId, timer)
  }

  cleanupRoom(roomId: string): void {
    this.rooms.delete(roomId)
    this.battleEngine.clearRoomSubmissions(roomId)

    const expireTimer = this.roomExpireTimers.get(roomId)
    if (expireTimer) {
      clearTimeout(expireTimer)
      this.roomExpireTimers.delete(roomId)
    }

    for (const [key, timer] of this.reconnectTimers.entries()) {
      if (key.startsWith(roomId + ':')) {
        clearTimeout(timer)
        this.reconnectTimers.delete(key)
      }
    }
  }
}
