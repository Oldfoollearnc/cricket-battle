/**
 * 共享类型定义 -- 服务端和客户端共用的数据结构
 */

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'insane'
export type VoicePriority = 'low' | 'normal' | 'high' | 'urgent'
export type RoomStatus = 'waiting' | 'countdown' | 'battling' | 'finished' | 'expired'
export type ParticleStyle = 'explosion' | 'pixel' | 'minimal'

export interface RoomConfig {
  maxPlayers: number
  difficulty: DifficultyLevel
  questionCount: number
  timeLimit: number
}

export interface Player {
  id: string
  name: string
  isReady: boolean
  isConnected: boolean
  score: number
  correctCount: number
  totalResponseTime: number
  totalAllResponseTime: number
  fastestCorrectTime: number
}

export interface Room {
  id: string
  hostId: string
  players: Player[]
  config: RoomConfig
  status: RoomStatus
  currentQuestionIndex: number
  questions: Question[]
  createdAt: number
}

export interface Question {
  id: string
  expression: string
  correctAnswer: number
  difficulty: DifficultyLevel
  index: number
}

export interface Submission {
  playerId: string
  questionId: string
  answer: number
  responseTime: number
  isCorrect: boolean
}

export interface AnswerResult {
  isCorrect: boolean
  correctAnswer: number
  responseTime: number
  serverTimestamp: number
}

export interface RankingEntry {
  playerId: string
  playerName: string
  score: number
  correctCount: number
  avgResponseTime: number
  rank: number
}

export interface PlayerResult {
  playerId: string
  playerName: string
  isWinner: boolean
  isDraw: boolean
  score: number
  correctCount: number
  totalQuestions: number
  avgResponseTime: number
  fastestTime: number
  rank: number
}

export interface MatchResult {
  playerId: string
  playerName: string
  isWinner: boolean
  isDraw: boolean
  score: number
  correctCount: number
  totalQuestions: number
  avgResponseTime: number
  fastestTime: number
  duration: number
  timestamp: number
  opponentCount: number
}

export interface PlayerStats {
  playerId: string
  totalMatches: number
  wins: number
  losses: number
  draws: number
  winRate: number
  bestTime: number
  currentStreak: number
  bestStreak: number
  avgResponseTime: number
  totalCorrect: number
  totalQuestions: number
  matchHistory: MatchResult[]
}

export interface ThemeColors {
  primary: string
  secondary: string
  background: string
  surface: string
  text: string
  textSecondary: string
  success: string
  error: string
  warning: string
  accent: string
}

export interface ThemeConfig {
  name: string
  label: string
  colors: ThemeColors
  fontFamily: string
  particleStyle: ParticleStyle
  isCustom: boolean
}

export interface BattleState {
  roomId: string
  status: RoomStatus
  currentQuestion: Question | null
  questionIndex: number
  totalQuestions: number
  timeRemaining: number
  timeLimit: number
  rankings: RankingEntry[]
  players: Player[]
  serverTimestamp: number
}

export interface RoomEvent {
  type: 'player_joined' | 'player_left' | 'player_ready' | 'battle_started' |
        'question_delivered' | 'answer_submitted' | 'answer_result' |
        'round_result' | 'battle_ended' | 'countdown' | 'room_closed'
  roomId: string
  data: any
  timestamp: number
}
