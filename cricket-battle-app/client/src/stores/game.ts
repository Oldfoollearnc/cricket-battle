/**
 * 游戏状态 Store -- 管理对战状态、房间信息、Socket 事件
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useNetworkSync } from '../composables/useNetworkSync'
import type {
  Room, Player, BattleState, Question, AnswerResult,
  RankingEntry, MatchResult, RoomConfig,
} from '@shared/types'

export const useGameStore = defineStore('game', () => {
  const network = useNetworkSync()

  const currentRoom = ref<Room | null>(null)
  const roomId = ref<string>('')
  const playerId = ref<string>('')
  const playerName = ref<string>('')

  const battleState = ref<BattleState | null>(null)
  const currentQuestion = ref<Question | null>(null)
  const questionStartTime = ref(0)
  const timeRemaining = ref(0)
  const rankings = ref<RankingEntry[]>([])
  const players = ref<Player[]>([])
  const lastAnswerResult = ref<AnswerResult | null>(null)
  const battleResults = ref<MatchResult[]>([])

  const view = ref<'lobby' | 'room' | 'battle' | 'result'>('lobby')
  const error = ref<string | null>(null)
  const isLoading = ref(false)

  const isHost = computed(() => playerId.value === currentRoom.value?.hostId)
  const allReady = computed(() => players.value.length >= 2 && players.value.every((p) => p.isReady))

  async function connect(): Promise<void> {
    try {
      await network.connect()
      setupListeners()
    } catch {
      error.value = '无法连接到服务器'
    }
  }

  function setupListeners(): void {
    network.on('room:player_joined', (data) => {
      players.value = data.players
    })

    network.on('room:player_left', (data) => {
      players.value = data.players
    })

    network.on('room:ready_changed', (data) => {
      players.value = data.players
    })

    network.on('room:player_disconnected', (data) => {
      const player = players.value.find((p) => p.id === data.playerId)
      if (player) player.isConnected = false
    })

    network.on('battle:started', (data: BattleState) => {
      battleState.value = data
      view.value = 'battle'
    })

    network.on('battle:question', (data) => {
      currentQuestion.value = data.question
      questionStartTime.value = Date.now()
      timeRemaining.value = data.timeLimit
      lastAnswerResult.value = null
    })

    network.on('battle:next_question', (data) => {
      currentQuestion.value = data.question
      questionStartTime.value = Date.now()
      timeRemaining.value = data.timeLimit ?? currentRoom.value?.config?.timeLimit ?? 15
      rankings.value = data.rankings
      lastAnswerResult.value = null
    })

    network.on('battle:answer_result', (data: AnswerResult) => {
      lastAnswerResult.value = data
    })

    network.on('battle:ranking_update', (data) => {
      rankings.value = data.rankings
      players.value = data.players
    })

    network.on('battle:ended', (data) => {
      battleResults.value = data.results
      rankings.value = data.rankings
      view.value = 'result'
      battleState.value = null
      currentQuestion.value = null
    })
  }

  async function createRoom(name: string, config?: Partial<RoomConfig>): Promise<void> {
    isLoading.value = true
    error.value = null
    playerName.value = name

    return new Promise((resolve, reject) => {
      network.send('room:create', { playerName: name, config }, (response) => {
        isLoading.value = false
        if (response.success) {
          currentRoom.value = response.room
          roomId.value = response.room.id
          playerId.value = response.playerId
          players.value = response.room.players
          view.value = 'room'
          resolve()
        } else {
          error.value = response.error
          reject(new Error(response.error))
        }
      })
    })
  }

  async function startPractice(name: string, config?: Partial<RoomConfig>): Promise<void> {
    isLoading.value = true
    error.value = null
    playerName.value = name

    return new Promise((resolve, reject) => {
      network.send('practice:start', { playerName: name, config }, (response) => {
        isLoading.value = false
        if (response.success) {
          currentRoom.value = response.room
          roomId.value = response.room.id
          playerId.value = response.playerId
          players.value = response.room.players
          battleState.value = response.battleState
          view.value = 'battle'
          resolve()
        } else {
          error.value = response.error
          reject(new Error(response.error))
        }
      })
    })
  }

  async function joinRoom(id: string, name: string): Promise<void> {
    isLoading.value = true
    error.value = null
    playerName.value = name

    return new Promise((resolve, reject) => {
      network.send('room:join', { roomId: id, playerName: name }, (response) => {
        isLoading.value = false
        if (response.success) {
          currentRoom.value = response.room
          roomId.value = response.room.id
          playerId.value = response.playerId
          players.value = response.room.players
          view.value = 'room'
          resolve()
        } else {
          error.value = response.error
          reject(new Error(response.error))
        }
      })
    })
  }

  function leaveRoom(): void {
    network.send('room:leave')
    currentRoom.value = null
    roomId.value = ''
    players.value = []
    view.value = 'lobby'
  }

  function toggleReady(): void {
    network.send('room:ready')
  }

  function startBattle(): void {
    network.send('battle:start', null, (response) => {
      if (!response.success) {
        error.value = response.error
      }
    })
  }

  function submitAnswer(answer: number): void {
    const clientStartTime = questionStartTime.value
    const clientEndTime = Date.now()
    const questionIndex = currentQuestion.value?.index ?? 0
    network.send('battle:answer', { answer, questionIndex, clientStartTime, clientEndTime }, (response) => {
      if (response.success) {
        lastAnswerResult.value = response.result
      }
    })
  }

  function backToLobby(): void {
    battleResults.value = []
    rankings.value = []
    players.value = []
    view.value = 'lobby'
    error.value = null
  }

  function restartBattle(): void {
    network.send('battle:restart', null, (response) => {
      if (!response.success) {
        error.value = response.error
      }
    })
  }

  function generateShareLink(): string {
    const base = window.location.origin
    return `${base}/room/${roomId.value}`
  }

  function generateShareText(): string {
    return `来跟我比算数！房间号 ${roomId.value}，点击链接直接加入: ${generateShareLink()}`
  }

  async function copyShareLink(): Promise<boolean> {
    const link = generateShareLink()
    try {
      await navigator.clipboard.writeText(link)
      return true
    } catch {
      return false
    }
  }

  async function copyShareText(): Promise<boolean> {
    const text = generateShareText()
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  return {
    currentRoom,
    roomId,
    playerId,
    playerName,
    battleState,
    currentQuestion,
    questionStartTime,
    timeRemaining,
    rankings,
    players,
    lastAnswerResult,
    battleResults,
    view,
    error,
    isLoading,

    isHost,
    allReady,

    connect,
    createRoom,
    startPractice,
    joinRoom,
    leaveRoom,
    toggleReady,
    startBattle,
    submitAnswer,
    backToLobby,
    generateShareLink,
    generateShareText,
    copyShareLink,
    copyShareText,
    restartBattle,
  }
})
