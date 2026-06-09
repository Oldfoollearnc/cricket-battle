/**
 * 输入校验器 -- 校验 Socket 事件数据 + 频率限制
 */

interface RateLimitEntry {
  count: number
  windowStart: number
}

const MAX_ANSWER_VALUE = 100_000
const MAX_PLAYER_NAME_LENGTH = 12
const ROOM_ID_PATTERN = /^[A-Z0-9]{6}$/
const RATE_LIMIT_WINDOW_MS = 1000
const RATE_LIMIT_MAX_PER_WINDOW = 1

export class InputValidator {
  private rateLimits = new Map<string, RateLimitEntry>()

  validateAnswer(data: unknown): { valid: boolean; answer?: number; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: '无效的请求数据' }
    }

    const { answer } = data as Record<string, unknown>

    if (typeof answer !== 'number' || !Number.isFinite(answer)) {
      return { valid: false, error: '答案必须是有效数字' }
    }

    if (Math.abs(answer) > MAX_ANSWER_VALUE) {
      return { valid: false, error: '答案超出范围' }
    }

    return { valid: true, answer }
  }

  validateCreateRoom(data: unknown): { valid: boolean; playerName?: string; config?: Record<string, unknown>; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: '无效的请求数据' }
    }

    const { playerName, config } = data as Record<string, unknown>

    if (typeof playerName !== 'string' || playerName.trim().length === 0) {
      return { valid: false, error: '昵称不能为空' }
    }

    if (playerName.length > MAX_PLAYER_NAME_LENGTH) {
      return { valid: false, error: `昵称不能超过${MAX_PLAYER_NAME_LENGTH}个字符` }
    }

    return { valid: true, playerName: playerName.trim(), config: config as Record<string, unknown> | undefined }
  }

  validateJoinRoom(data: unknown): { valid: boolean; roomId?: string; playerName?: string; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: '无效的请求数据' }
    }

    const { roomId, playerName } = data as Record<string, unknown>

    if (typeof roomId !== 'string' || !ROOM_ID_PATTERN.test(roomId)) {
      return { valid: false, error: '房间号格式无效（需要6位大写字母数字）' }
    }

    if (typeof playerName !== 'string' || playerName.trim().length === 0) {
      return { valid: false, error: '昵称不能为空' }
    }

    if (playerName.length > MAX_PLAYER_NAME_LENGTH) {
      return { valid: false, error: `昵称不能超过${MAX_PLAYER_NAME_LENGTH}个字符` }
    }

    return { valid: true, roomId, playerName: playerName.trim() }
  }

  checkRateLimit(socketId: string, event: string): { allowed: boolean; retryAfter?: number } {
    const key = `${socketId}:${event}`
    const now = Date.now()
    const entry = this.rateLimits.get(key)

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      this.rateLimits.set(key, { count: 1, windowStart: now })
      return { allowed: true }
    }

    if (entry.count >= RATE_LIMIT_MAX_PER_WINDOW) {
      const retryAfter = RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)
      return { allowed: false, retryAfter }
    }

    entry.count++
    return { allowed: true }
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.rateLimits.entries()) {
      if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
        this.rateLimits.delete(key)
      }
    }
  }

  removeSocket(socketId: string): void {
    for (const key of this.rateLimits.keys()) {
      if (key.startsWith(socketId + ':')) {
        this.rateLimits.delete(key)
      }
    }
  }
}
