/**
 * 服务端入口 -- Express + Socket.io 服务器
 */

import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { GameRoomManager } from './managers/GameRoomManager.js'
import { DatabaseManager } from './managers/DatabaseManager.js'
import { BattleEngine } from './engines/BattleEngine.js'
import { InputValidator } from './engines/InputValidator.js'
import type { RoomConfig } from '../shared/types.js'

const PORT = Number(process.env.PORT) || 3001
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

const app = express()
app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
})

const battleEngine = new BattleEngine()
const roomManager = new GameRoomManager(battleEngine)
const dbManager = new DatabaseManager()
const validator = new InputValidator()

const roomQuestionTimers = new Map<string, ReturnType<typeof setTimeout>>()

setInterval(() => validator.cleanup(), 60_000)

app.get('/api/rooms', (_req, res) => {
  const rooms = roomManager.getRooms().map((r) => ({
    id: r.id,
    playerCount: r.players.length,
    maxPlayers: r.config.maxPlayers,
    status: r.status,
    difficulty: r.config.difficulty,
  }))
  res.json(rooms)
})

app.get('/api/stats/:playerId', (req, res) => {
  const stats = dbManager.getPlayerStats(req.params.playerId)
  res.json(stats)
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

io.on('connection', (socket) => {
  let currentRoomId: string | null = null
  let currentPlayerId: string | null = null

  socket.on('practice:start', (data: { playerName: string; config?: Partial<RoomConfig> }, callback) => {
    const validation = validator.validateCreateRoom(data)
    if (!validation.valid) {
      callback?.({ success: false, error: validation.error })
      return
    }

    try {
      const battleState = roomManager.createSoloPractice(socket.id, validation.playerName!, data.config)
      const room = roomManager.getRoom(battleState.roomId)!
      socket.join(room.id)
      currentRoomId = room.id
      currentPlayerId = socket.id
      callback({ success: true, room, battleState, playerId: socket.id })
      startQuestionCycle(room.id)
    } catch (err: any) {
      callback({ success: false, error: err.message })
    }
  })

  socket.on('room:create', (data: { playerName: string; config?: Partial<RoomConfig> }, callback) => {
    const validation = validator.validateCreateRoom(data)
    if (!validation.valid) {
      callback?.({ success: false, error: validation.error })
      return
    }

    try {
      const room = roomManager.createRoom(socket.id, validation.playerName!, data.config)
      socket.join(room.id)
      currentRoomId = room.id
      currentPlayerId = socket.id
      callback({ success: true, room, playerId: socket.id })
    } catch (err: any) {
      callback({ success: false, error: err.message })
    }
  })

  socket.on('room:join', (data: { roomId: string; playerName: string }, callback) => {
    const validation = validator.validateJoinRoom(data)
    if (!validation.valid) {
      callback?.({ success: false, error: validation.error })
      return
    }

    try {
      const room = roomManager.joinRoom(validation.roomId!, socket.id, validation.playerName!)
      socket.join(room.id)
      currentRoomId = room.id
      currentPlayerId = socket.id

      io.to(room.id).emit('room:player_joined', {
        player: room.players.find((p) => p.id === socket.id),
        players: room.players,
      })

      callback({ success: true, room, playerId: socket.id })
    } catch (err: any) {
      callback({ success: false, error: err.message })
    }
  })

  socket.on('room:leave', () => {
    handleLeave()
  })

  socket.on('room:ready', (callback) => {
    if (!currentRoomId) return
    try {
      const room = roomManager.toggleReady(currentRoomId, socket.id)
      io.to(room.id).emit('room:ready_changed', {
        playerId: socket.id,
        isReady: room.players.find((p) => p.id === socket.id)?.isReady,
        players: room.players,
      })
      callback?.({ success: true })
    } catch (err: any) {
      callback?.({ success: false, error: err.message })
    }
  })

  socket.on('battle:start', (callback) => {
    if (!currentRoomId) return
    try {
      const room = roomManager.getRoom(currentRoomId)
      if (!room || room.hostId !== socket.id) {
        callback?.({ success: false, error: '只有房主才能开始对战' })
        return
      }
      const battleState = roomManager.startBattle(currentRoomId)
      io.to(currentRoomId).emit('battle:started', battleState)
      startQuestionCycle(currentRoomId)
      callback?.({ success: true })
    } catch (err: any) {
      callback?.({ success: false, error: err.message })
    }
  })

  socket.on('battle:answer', (data: { answer: number; questionIndex: number; clientStartTime: number; clientEndTime: number }, callback) => {
    if (!currentRoomId || !currentPlayerId) {
      callback?.({ success: false, error: '未加入房间' })
      return
    }

    const rateCheck = validator.checkRateLimit(socket.id, 'battle:answer')
    if (!rateCheck.allowed) {
      callback?.({ success: false, error: `请求过于频繁，请${rateCheck.retryAfter}ms后重试` })
      return
    }

    const answerValidation = validator.validateAnswer({ answer: data.answer })
    if (!answerValidation.valid) {
      callback?.({ success: false, error: answerValidation.error })
      return
    }

    try {
      const room = roomManager.getRoom(currentRoomId)
      if (!room) throw new Error('房间不存在')

      // questionIndex 校验
      if (typeof data.questionIndex !== 'number' || data.questionIndex !== room.currentQuestionIndex) {
        callback?.({ success: false, error: '题目序号不匹配' })
        return
      }

      // 服务端时间戳校验：异常时间戳直接拒绝
      const timeLimitMs = room.config.timeLimit * 1000
      const timestampValidation = battleEngine.validateClientTimestamp(
        data.clientStartTime, Date.now(), timeLimitMs,
      )
      if (!timestampValidation.valid) {
        callback?.({ success: false, error: timestampValidation.reason })
        return
      }

      const { accepted, result } = roomManager.recordAnswer(
        currentRoomId,
        currentPlayerId,
        data.questionIndex,
        answerValidation.answer!,
        data.clientStartTime,
        data.clientEndTime,
      )

      if (!accepted) {
        callback?.({ success: false, error: '该题已提交过答案' })
        return
      }

      socket.emit('battle:answer_result', result)

      io.to(currentRoomId).emit('battle:ranking_update', {
        rankings: battleEngine.calculateRanking(room.players),
        players: room.players,
      })

      callback?.({ success: true, result })

      // 所有在线玩家答完后立即切换下一题
      if (roomManager.haveAllPlayersAnswered(currentRoomId)) {
        advanceToNextQuestion(currentRoomId)
      }
    } catch (err: any) {
      callback?.({ success: false, error: err.message })
    }
  })

  socket.on('disconnect', () => {
    validator.removeSocket(socket.id)
    if (currentRoomId && currentPlayerId) {
      roomManager.handleDisconnect(currentRoomId, currentPlayerId)
      io.to(currentRoomId).emit('room:player_disconnected', {
        playerId: currentPlayerId,
      })
    }
  })

  socket.on('battle:restart', (callback) => {
    if (!currentRoomId) return
    try {
      const room = roomManager.getRoom(currentRoomId)
      if (!room || room.hostId !== socket.id) {
        callback?.({ success: false, error: '只有房主才能重新开始' })
        return
      }

      const battleState = roomManager.restartBattle(currentRoomId)
      io.to(currentRoomId).emit('battle:started', battleState)
      startQuestionCycle(currentRoomId)
      callback?.({ success: true })
    } catch (err: any) {
      callback?.({ success: false, error: err.message })
    }
  })

  function handleLeave() {
    if (!currentRoomId || !currentPlayerId) return

    const room = roomManager.leaveRoom(currentRoomId, currentPlayerId)
    socket.leave(currentRoomId)

    io.to(currentRoomId).emit('room:player_left', {
      playerId: currentPlayerId,
      players: room?.players ?? [],
    })

    currentRoomId = null
    currentPlayerId = null
  }

  function startQuestionCycle(roomId: string) {
    const room = roomManager.getRoom(roomId)
    if (!room) return

    const question = roomManager.getCurrentQuestion(roomId)
    if (question) {
      io.to(roomId).emit('battle:question', {
        question,
        questionIndex: 0,
        totalQuestions: room.questions.length,
        timeLimit: room.config.timeLimit,
        serverTimestamp: Date.now(),
      })
    }

    scheduleNextQuestion(roomId, room.config.timeLimit)
  }

  function scheduleNextQuestion(roomId: string, timeLimitSec: number) {
    const existingTimer = roomQuestionTimers.get(roomId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(() => {
      roomQuestionTimers.delete(roomId)
      advanceToNextQuestion(roomId)
    }, timeLimitSec * 1000)

    roomQuestionTimers.set(roomId, timer)
  }

  function advanceToNextQuestion(roomId: string) {
    const existingTimer = roomQuestionTimers.get(roomId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      roomQuestionTimers.delete(roomId)
    }

    const currentRoom = roomManager.getRoom(roomId)
    if (!currentRoom || currentRoom.status !== 'battling') return

    const nextQuestion = roomManager.advanceQuestion(roomId)
    if (nextQuestion) {
      io.to(roomId).emit('battle:next_question', {
        question: nextQuestion,
        questionIndex: currentRoom.currentQuestionIndex,
        totalQuestions: currentRoom.questions.length,
        timeLimit: currentRoom.config.timeLimit,
        rankings: battleEngine.calculateRanking(currentRoom.players),
        serverTimestamp: Date.now(),
      })

      scheduleNextQuestion(roomId, currentRoom.config.timeLimit)
    } else {
      const results = roomManager.getPlayerResults(roomId)

      for (const result of results) {
        dbManager.recordMatch(result)
      }

      io.to(roomId).emit('battle:ended', {
        results,
        rankings: battleEngine.calculateRanking(currentRoom.players),
      })

      roomManager.setRoomExpireTimer(roomId, () => {
        roomManager.cleanupRoom(roomId)
      })
    }
  }
})

httpServer.listen(PORT, () => {
  console.log(`Cricket Battle Server running on port ${PORT}`)
})

export { app, httpServer, io }
