/**
 * 网络同步 -- 封装 Socket.io 客户端，处理所有网络通信
 */

import { ref, readonly } from 'vue'
import { io, Socket } from 'socket.io-client'

const socket = ref<Socket | null>(null)
const isConnected = ref(false)
const isReconnecting = ref(false)

export function useNetworkSync() {
  function connect(serverUrl: string = 'http://localhost:3001'): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.value = io(serverUrl, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      })

      socket.value.on('connect', () => {
        isConnected.value = true
        isReconnecting.value = false
        resolve()
      })

      socket.value.on('disconnect', () => {
        isConnected.value = false
      })

      socket.value.on('reconnect_attempt', () => {
        isReconnecting.value = true
      })

      socket.value.on('reconnect', () => {
        isConnected.value = true
        isReconnecting.value = false
      })

      socket.value.on('connect_error', (err) => {
        if (!socket.value?.connected) {
          reject(err)
        }
      })
    })
  }

  function disconnect(): void {
    socket.value?.disconnect()
    socket.value = null
    isConnected.value = false
  }

  function send(event: string, data?: any, callback?: (response: any) => void): void {
    if (!socket.value?.connected) {
      console.warn('Socket not connected, cannot send:', event)
      return
    }
    if (callback) {
      socket.value.emit(event, data, callback)
    } else {
      socket.value.emit(event, data)
    }
  }

  function on(event: string, callback: (data: any) => void): void {
    socket.value?.on(event, callback)
  }

  function off(event: string, callback?: (...args: any[]) => void): void {
    if (callback) {
      socket.value?.off(event, callback)
    } else {
      socket.value?.off(event)
    }
  }

  return {
    isConnected: readonly(isConnected),
    isReconnecting: readonly(isReconnecting),
    connect,
    disconnect,
    send,
    on,
    off,
  }
}
