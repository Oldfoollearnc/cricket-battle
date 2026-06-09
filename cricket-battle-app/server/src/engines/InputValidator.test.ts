/**
 * InputValidator 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { InputValidator } from './InputValidator.js'

describe('InputValidator', () => {
  let validator: InputValidator

  beforeEach(() => {
    validator = new InputValidator()
  })

  describe('validateAnswer', () => {
    it('接受有效数字答案', () => {
      const result = validator.validateAnswer({ answer: 42 })
      expect(result.valid).toBe(true)
      expect(result.answer).toBe(42)
    })

    it('接受负数答案', () => {
      const result = validator.validateAnswer({ answer: -10 })
      expect(result.valid).toBe(true)
      expect(result.answer).toBe(-10)
    })

    it('接受零', () => {
      const result = validator.validateAnswer({ answer: 0 })
      expect(result.valid).toBe(true)
      expect(result.answer).toBe(0)
    })

    it('接受浮点数答案', () => {
      const result = validator.validateAnswer({ answer: 3.14 })
      expect(result.valid).toBe(true)
    })

    it('拒绝 null', () => {
      const result = validator.validateAnswer(null)
      expect(result.valid).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('拒绝 undefined', () => {
      const result = validator.validateAnswer(undefined)
      expect(result.valid).toBe(false)
    })

    it('拒绝非数字', () => {
      const result = validator.validateAnswer({ answer: 'abc' })
      expect(result.valid).toBe(false)
    })

    it('拒绝 NaN', () => {
      const result = validator.validateAnswer({ answer: NaN })
      expect(result.valid).toBe(false)
    })

    it('拒绝 Infinity', () => {
      const result = validator.validateAnswer({ answer: Infinity })
      expect(result.valid).toBe(false)
    })

    it('拒绝超出范围的答案', () => {
      const result = validator.validateAnswer({ answer: 999999 })
      expect(result.valid).toBe(false)
    })

    it('接受边界值', () => {
      const result = validator.validateAnswer({ answer: 100000 })
      expect(result.valid).toBe(true)
    })
  })

  describe('validateCreateRoom', () => {
    it('接受有效的创建房间请求', () => {
      const result = validator.validateCreateRoom({ playerName: 'Alice' })
      expect(result.valid).toBe(true)
      expect(result.playerName).toBe('Alice')
    })

    it('去除昵称首尾空格', () => {
      const result = validator.validateCreateRoom({ playerName: '  Alice  ' })
      expect(result.valid).toBe(true)
      expect(result.playerName).toBe('Alice')
    })

    it('拒绝空昵称', () => {
      const result = validator.validateCreateRoom({ playerName: '' })
      expect(result.valid).toBe(false)
    })

    it('拒绝超长昵称', () => {
      const result = validator.validateCreateRoom({ playerName: 'A'.repeat(13) })
      expect(result.valid).toBe(false)
    })

    it('接受最大长度昵称', () => {
      const result = validator.validateCreateRoom({ playerName: 'A'.repeat(12) })
      expect(result.valid).toBe(true)
    })

    it('拒绝 null 数据', () => {
      const result = validator.validateCreateRoom(null)
      expect(result.valid).toBe(false)
    })

    it('拒绝缺少 playerName', () => {
      const result = validator.validateCreateRoom({})
      expect(result.valid).toBe(false)
    })
  })

  describe('validateJoinRoom', () => {
    it('接受有效的加入房间请求', () => {
      const result = validator.validateJoinRoom({ roomId: 'ABC123', playerName: 'Bob' })
      expect(result.valid).toBe(true)
      expect(result.roomId).toBe('ABC123')
      expect(result.playerName).toBe('Bob')
    })

    it('拒绝小写房间号', () => {
      const result = validator.validateJoinRoom({ roomId: 'abc123', playerName: 'Bob' })
      expect(result.valid).toBe(false)
    })

    it('拒绝过短房间号', () => {
      const result = validator.validateJoinRoom({ roomId: 'AB12', playerName: 'Bob' })
      expect(result.valid).toBe(false)
    })

    it('拒绝过长房间号', () => {
      const result = validator.validateJoinRoom({ roomId: 'ABC1234', playerName: 'Bob' })
      expect(result.valid).toBe(false)
    })

    it('拒绝空昵称', () => {
      const result = validator.validateJoinRoom({ roomId: 'ABC123', playerName: '' })
      expect(result.valid).toBe(false)
    })
  })

  describe('removeSocket', () => {
    it('清除指定 socket 的频率限制条目', () => {
      validator.checkRateLimit('socket1', 'battle:answer')
      validator.checkRateLimit('socket1', 'room:create')
      validator.checkRateLimit('socket2', 'battle:answer')

      validator.removeSocket('socket1')

      // socket1 的条目被清除，可以再次请求
      const result1 = validator.checkRateLimit('socket1', 'battle:answer')
      expect(result1.allowed).toBe(true)

      // socket2 不受影响
      const result2 = validator.checkRateLimit('socket2', 'battle:answer')
      expect(result2.allowed).toBe(false)
    })
  })

  describe('checkRateLimit', () => {
    it('首次请求允许通过', () => {
      const result = validator.checkRateLimit('socket1', 'battle:answer')
      expect(result.allowed).toBe(true)
    })

    it('同一窗口内第二次请求被拒绝', () => {
      validator.checkRateLimit('socket1', 'battle:answer')
      const result = validator.checkRateLimit('socket1', 'battle:answer')
      expect(result.allowed).toBe(false)
      expect(result.retryAfter).toBeGreaterThan(0)
    })

    it('不同 socket 的请求互不影响', () => {
      validator.checkRateLimit('socket1', 'battle:answer')
      const result = validator.checkRateLimit('socket2', 'battle:answer')
      expect(result.allowed).toBe(true)
    })

    it('不同事件的请求互不影响', () => {
      validator.checkRateLimit('socket1', 'battle:answer')
      const result = validator.checkRateLimit('socket1', 'room:create')
      expect(result.allowed).toBe(true)
    })
  })
})
