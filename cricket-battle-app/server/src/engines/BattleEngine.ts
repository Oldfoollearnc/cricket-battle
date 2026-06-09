/**
 * 对战引擎 -- 生成题目、判定答案、计算排名
 */

import { v4 as uuidv4 } from 'uuid'
import type { Question, DifficultyLevel, AnswerResult, RankingEntry, Player } from '../../shared/types.js'

interface OperatorConfig {
  symbol: string
  fn: (a: number, b: number) => number
}

const OPERATORS: Record<string, OperatorConfig[]> = {
  easy: [
    { symbol: '+', fn: (a, b) => a + b },
    { symbol: '-', fn: (a, b) => a - b },
  ],
  medium: [
    { symbol: '+', fn: (a, b) => a + b },
    { symbol: '-', fn: (a, b) => a - b },
    { symbol: '*', fn: (a, b) => a * b },
  ],
  hard: [
    { symbol: '+', fn: (a, b) => a + b },
    { symbol: '-', fn: (a, b) => a - b },
    { symbol: '*', fn: (a, b) => a * b },
  ],
  insane: [
    { symbol: '+', fn: (a, b) => a + b },
    { symbol: '-', fn: (a, b) => a - b },
    { symbol: '*', fn: (a, b) => a * b },
    { symbol: '/', fn: (a, b) => a / b },
  ],
}

const RANGE_CONFIG: Record<DifficultyLevel, { min: number; max: number; ops: number }> = {
  easy: { min: 1, max: 20, ops: 1 },
  medium: { min: 2, max: 50, ops: 2 },
  hard: { min: 5, max: 99, ops: 2 },
  insane: { min: 10, max: 99, ops: 3 },
}

export class BattleEngine {
  private roomSubmissions = new Map<string, Map<number, Set<string>>>()

  generateQuestion(difficulty: DifficultyLevel, index: number): Question {
    const config = RANGE_CONFIG[difficulty]
    const operators = OPERATORS[difficulty]

    const operandCount = config.ops + 1
    const operands: number[] = []
    const selectedOps: OperatorConfig[] = []

    for (let i = 0; i < operandCount; i++) {
      operands.push(this.randomInt(config.min, config.max))
    }
    for (let i = 0; i < config.ops; i++) {
      selectedOps.push(operators[this.randomInt(0, operators.length - 1)])
    }

    // 先生成最终答案，保证整数结果
    const { expression, answer } = this.buildExpression(operands, selectedOps, difficulty)

    return {
      id: uuidv4(),
      expression,
      correctAnswer: answer,
      difficulty,
      index,
    }
  }

  private buildExpression(
    operands: number[],
    ops: OperatorConfig[],
    difficulty: DifficultyLevel,
  ): { expression: string; answer: number } {
    const adjustedOperands = [...operands]
    const adjustedOps = [...ops]

    // 对于除法，保证除法子表达式整除
    for (let i = 0; i < adjustedOps.length; i++) {
      if (adjustedOps[i].symbol === '/') {
        const divisor = adjustedOperands[i + 1] || 2
        const quotient = this.randomInt(2, 12)
        adjustedOperands[i] = divisor * quotient
      }
    }

    // 如果有除法，验证整个表达式结果是整数，不是的话重新生成
    if (adjustedOps.some((op) => op.symbol === '/')) {
      const answer = this.evaluateExpression(adjustedOperands, adjustedOps)
      if (!Number.isInteger(answer)) {
        // 把除法换成乘法来保证整数结果
        for (let i = 0; i < adjustedOps.length; i++) {
          if (adjustedOps[i].symbol === '/') {
            adjustedOps[i] = { symbol: '*', fn: (a, b) => a * b }
          }
        }
      }
    }

    let expression = String(adjustedOperands[0])
    for (let i = 0; i < adjustedOps.length; i++) {
      expression += ` ${adjustedOps[i].symbol} ${adjustedOperands[i + 1]}`
    }

    const answer = this.evaluateExpression(adjustedOperands, adjustedOps)
    return { expression, answer }
  }

  private evaluateExpression(operands: number[], ops: OperatorConfig[]): number {
    // 先乘除后加减
    const nums = [...operands]
    const operators = [...ops]

    // 第一遍：处理 * 和 /
    for (let i = 0; i < operators.length; i++) {
      if (operators[i].symbol === '*' || operators[i].symbol === '/') {
        nums[i] = operators[i].fn(nums[i], nums[i + 1])
        nums.splice(i + 1, 1)
        operators.splice(i, 1)
        i--
      }
    }

    // 第二遍：处理 + 和 -
    let result = nums[0]
    for (let i = 0; i < operators.length; i++) {
      result = operators[i].fn(result, nums[i + 1])
    }

    return Math.round(result * 100) / 100
  }

  checkAnswer(
    question: Question,
    userAnswer: number,
    clientStartTime: number,
    clientEndTime: number,
    serverTimestamp: number,
    serverTimeLimitMs: number,
  ): AnswerResult {
    const isCorrect = Math.abs(question.correctAnswer - userAnswer) < 0.01

    // 服务端校验：客户端开始时间不能早于题目下发时间太多（超过宽容度直接拒绝）
    const START_TIME_TOLERANCE_MS = 500
    const adjustedStartTime = Math.max(clientStartTime, serverTimestamp - START_TIME_TOLERANCE_MS)

    // 服务端校验：最小人类反应时间
    const MIN_RESPONSE_TIME_MS = 200
    const rawResponseTime = clientEndTime - adjustedStartTime
    const clampedResponseTime = Math.max(MIN_RESPONSE_TIME_MS, Math.min(rawResponseTime, serverTimeLimitMs + 1000))

    const responseTime = Math.max(MIN_RESPONSE_TIME_MS, Math.min(clampedResponseTime, serverTimeLimitMs))

    return {
      isCorrect,
      correctAnswer: question.correctAnswer,
      responseTime,
      serverTimestamp: Date.now(),
    }
  }

  /**
   * 校验客户端时间戳是否合法
   * 异常时间戳直接拒绝，不进行修正
   */
  validateClientTimestamp(
    clientStartTime: number,
    serverTimestamp: number,
    timeLimitMs: number,
  ): { valid: boolean; reason?: string } {
    const MAX_CLOCK_DRIFT_MS = 2000
    const MIN_CLIENT_START_MS = serverTimestamp - MAX_CLOCK_DRIFT_MS
    const MAX_CLIENT_START_MS = serverTimestamp + MAX_CLOCK_DRIFT_MS

    // 客户端开始时间不能远早于服务端下发时间
    if (clientStartTime < MIN_CLIENT_START_MS) {
      return { valid: false, reason: '客户端时间戳异常（过早）' }
    }

    // 客户端开始时间不能晚于当前服务端时间
    if (clientStartTime > MAX_CLIENT_START_MS) {
      return { valid: false, reason: '客户端时间戳异常（过晚）' }
    }

    return { valid: true }
  }

  calculateRanking(players: Player[]): RankingEntry[] {
    const entries: RankingEntry[] = players.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      score: p.score,
      correctCount: p.correctCount,
      avgResponseTime: p.correctCount > 0 ? p.totalResponseTime / p.correctCount : Infinity,
      rank: 0,
    }))

    entries.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      if (a.correctCount !== b.correctCount) return b.correctCount - a.correctCount
      return a.avgResponseTime - b.avgResponseTime
    })

    entries.forEach((entry, index) => {
      entry.rank = index + 1
    })

    return entries
  }

  generateQuestionBatch(difficulty: DifficultyLevel, count: number): Question[] {
    const questions: Question[] = []
    for (let i = 0; i < count; i++) {
      questions.push(this.generateQuestion(difficulty, i))
    }
    return questions
  }

  recordAnswer(
    roomId: string,
    questionIndex: number,
    playerId: string,
    answer: number,
    responseTime: number,
  ): { accepted: boolean; reason?: string } {
    let roomMap = this.roomSubmissions.get(roomId)
    if (!roomMap) {
      roomMap = new Map()
      this.roomSubmissions.set(roomId, roomMap)
    }

    let questionSet = roomMap.get(questionIndex)
    if (!questionSet) {
      questionSet = new Set()
      roomMap.set(questionIndex, questionSet)
    }

    if (questionSet.has(playerId)) {
      return { accepted: false, reason: '该题已提交过答案' }
    }

    questionSet.add(playerId)
    return { accepted: true }
  }

  clearRoomSubmissions(roomId: string): void {
    this.roomSubmissions.delete(roomId)
  }

  /**
   * 检查指定玩家列表是否都已提交了当前题目的答案
   */
  haveAllPlayersAnswered(
    roomId: string,
    questionIndex: number,
    playerIds: string[],
  ): boolean {
    const roomMap = this.roomSubmissions.get(roomId)
    if (!roomMap) return false

    const questionSet = roomMap.get(questionIndex)
    if (!questionSet) return false

    return playerIds.every((id) => questionSet.has(id))
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
}
