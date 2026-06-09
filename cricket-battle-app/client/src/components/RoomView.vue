/**
 * 房间视图 -- 等待玩家加入、准备、开始对战
 */
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '../stores/game'

const game = useGameStore()

const currentPlayer = computed(() =>
  game.players.find((p) => p.id === game.playerId)
)

const isReady = computed(() => currentPlayer.value?.isReady ?? false)

const shareCopied = ref(false)
const shareTextCopied = ref(false)

function copyRoomId() {
  navigator.clipboard.writeText(game.roomId)
}

async function copyShareLink() {
  const ok = await game.copyShareLink()
  if (ok) {
    shareCopied.value = true
    setTimeout(() => { shareCopied.value = false }, 2000)
  }
}

async function copyShareText() {
  const ok = await game.copyShareText()
  if (ok) {
    shareTextCopied.value = true
    setTimeout(() => { shareTextCopied.value = false }, 2000)
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (confirm('确定要退出房间吗？')) {
      game.leaveRoom()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="room">
    <div class="room-header">
      <h2>房间 <span class="room-id" @click="copyRoomId" title="点击复制房间号">{{ game.roomId }}</span></h2>
      <div class="header-actions">
        <button class="btn btn-sm" @click="copyShareText" :title="shareTextCopied ? '已复制' : '复制邀请文案'">
          {{ shareTextCopied ? '已复制' : '邀请好友' }}
        </button>
        <button class="btn btn-sm" @click="copyShareLink" :title="shareCopied ? '已复制' : '复制分享链接'">
          {{ shareCopied ? '已复制' : '复制链接' }}
        </button>
        <button class="btn btn-danger" @click="game.leaveRoom()">退出</button>
      </div>
    </div>

    <div class="room-info card">
      <div class="info-item">
        <span class="info-label">难度</span>
        <span class="info-value">{{ game.currentRoom?.config?.difficulty }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">题目数</span>
        <span class="info-value">{{ game.currentRoom?.config?.questionCount }} 题</span>
      </div>
      <div class="info-item">
        <span class="info-label">每题限时</span>
        <span class="info-value">{{ game.currentRoom?.config?.timeLimit }} 秒</span>
      </div>
      <div class="info-item">
        <span class="info-label">人数</span>
        <span class="info-value">{{ game.players.length }} / {{ game.currentRoom?.config?.maxPlayers }}</span>
      </div>
    </div>

    <div class="player-list">
      <h3>玩家列表</h3>
      <div
        v-for="player in game.players"
        :key="player.id"
        class="player-item card"
        :class="{ 'is-self': player.id === game.playerId, 'is-disconnected': !player.isConnected }"
      >
        <div class="player-name">
          {{ player.name }}
          <span v-if="player.id === game.currentRoom?.hostId" class="host-badge">房主</span>
          <span v-if="!player.isConnected" class="dc-badge">断线</span>
        </div>
        <div class="player-status" :class="{ ready: player.isReady }">
          {{ player.isReady ? '已准备' : '未准备' }}
        </div>
      </div>

      <!-- 空位占位 -->
      <div
        v-for="i in ((game.currentRoom?.config?.maxPlayers ?? 4) - game.players.length)"
        :key="'empty-' + i"
        class="player-item card empty-slot"
      >
        <span>等待加入...</span>
      </div>
    </div>

    <div class="room-actions">
      <button
        class="btn"
        :class="isReady ? 'btn-danger' : 'btn-success'"
        @click="game.toggleReady()"
      >
        {{ isReady ? '取消准备' : '准备' }}
      </button>
      <button
        v-if="game.isHost"
        class="btn btn-primary"
        :disabled="!game.allReady"
        @click="game.startBattle()"
      >
        开始对战
      </button>
    </div>

    <p v-if="game.isHost && !game.allReady" class="hint">
      等待所有玩家准备后即可开始
    </p>
    <p v-if="!game.isHost" class="hint">
      等待房主开始对战
    </p>
    <p class="shortcut-hint">按 Esc 退出房间</p>
  </div>
</template>

<style scoped>
.room {
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.8rem;
}

.room-header h2 {
  font-size: 1.3rem;
}

.room-id {
  color: var(--color-primary);
  cursor: pointer;
  font-size: 1.5rem;
  letter-spacing: 3px;
  text-shadow: 0 0 8px var(--color-primary);
}

.room-id:hover {
  text-shadow: 0 0 15px var(--color-primary);
}

.room-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.info-value {
  font-size: 1rem;
  font-weight: 700;
}

.player-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.player-list h3 {
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.player-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
}

.player-item.is-self {
  border-color: var(--color-primary);
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.1);
}

.player-item.is-disconnected {
  opacity: 0.5;
}

.player-name {
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.host-badge {
  font-size: 0.7rem;
  background: var(--color-warning);
  color: var(--color-background);
  padding: 2px 6px;
  border-radius: 2px;
  font-weight: 700;
}

.dc-badge {
  font-size: 0.7rem;
  background: var(--color-error);
  color: white;
  padding: 2px 6px;
  border-radius: 2px;
}

.player-status {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.player-status.ready {
  color: var(--color-success);
  font-weight: 700;
}

.empty-slot {
  opacity: 0.3;
  border-style: dashed;
}

.room-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.room-actions .btn {
  min-width: 120px;
  padding: 12px 24px;
  font-size: 1rem;
}

.hint {
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.shortcut-hint {
  text-align: center;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  opacity: 0.6;
}
</style>
