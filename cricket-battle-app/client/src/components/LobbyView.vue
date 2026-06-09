/**
 * 大厅视图 -- 创建/加入房间的入口界面
 */
<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '../stores/game'

const game = useGameStore()
const playerName = ref(localStorage.getItem('cricket-player-name') || '')
const joinRoomId = ref('')
const mode = ref<'menu' | 'create' | 'join'>('menu')
const maxPlayers = ref(4)
const difficulty = ref<'easy' | 'medium' | 'hard' | 'insane'>('easy')
const questionCount = ref(10)
const timeLimit = ref(15)

// 快速开始：使用上次保存的配置
const savedConfig = loadSavedConfig()

function loadSavedConfig() {
  const stored = localStorage.getItem('cricket-quick-config')
  if (stored) {
    try { return JSON.parse(stored) } catch { /* corrupted */ }
  }
  return null
}

function saveConfig() {
  localStorage.setItem('cricket-quick-config', JSON.stringify({
    maxPlayers: maxPlayers.value,
    difficulty: difficulty.value,
    questionCount: questionCount.value,
    timeLimit: timeLimit.value,
  }))
}

async function handleQuickStart() {
  if (!playerName.value.trim()) return
  localStorage.setItem('cricket-player-name', playerName.value)
  const config = savedConfig ?? {
    maxPlayers: maxPlayers.value,
    difficulty: difficulty.value,
    questionCount: questionCount.value,
    timeLimit: timeLimit.value,
  }
  await game.createRoom(playerName.value, config)
}

async function handleCreate() {
  if (!playerName.value.trim()) return
  localStorage.setItem('cricket-player-name', playerName.value)
  saveConfig()
  await game.createRoom(playerName.value, {
    maxPlayers: maxPlayers.value,
    difficulty: difficulty.value,
    questionCount: questionCount.value,
    timeLimit: timeLimit.value,
  })
}

async function handleJoin() {
  if (!playerName.value.trim() || !joinRoomId.value.trim()) return
  localStorage.setItem('cricket-player-name', playerName.value)
  await game.joinRoom(joinRoomId.value.toUpperCase(), playerName.value)
}

async function handlePractice() {
  if (!playerName.value.trim()) return
  localStorage.setItem('cricket-player-name', playerName.value)
  await game.startPractice(playerName.value, {
    difficulty: difficulty.value,
    questionCount: questionCount.value,
    timeLimit: timeLimit.value,
  })
}
</script>

<template>
  <div class="lobby">
    <div class="lobby-hero">
      <h2 class="hero-title">Cricket Battle</h2>
      <p class="hero-subtitle">实时对战竞技计算器</p>
    </div>

    <!-- 菜单 -->
    <div v-if="mode === 'menu'" class="lobby-actions">
      <div class="name-input">
        <input
          v-model="playerName"
          class="input"
          placeholder="输入你的昵称"
          maxlength="12"
          @keyup.enter="handleQuickStart"
        />
      </div>
      <div class="action-buttons action-buttons-main">
        <button class="btn btn-primary btn-quick-start" @click="handleQuickStart" :disabled="!playerName.trim() || game.isLoading">
          快速开始
        </button>
      </div>
      <div class="action-buttons">
        <button class="btn btn-success" @click="handlePractice" :disabled="!playerName.trim() || game.isLoading">
          单人练习
        </button>
        <button class="btn" @click="mode = 'create'" :disabled="!playerName.trim()">
          创建房间
        </button>
        <button class="btn" @click="mode = 'join'" :disabled="!playerName.trim()">
          加入房间
        </button>
      </div>
    </div>

    <!-- 创建房间 -->
    <div v-else-if="mode === 'create'" class="lobby-form card">
      <h3>创建房间</h3>
      <div class="form-group">
        <label>最大人数</label>
        <select v-model="maxPlayers" class="input">
          <option :value="2">2 人</option>
          <option :value="3">3 人</option>
          <option :value="4">4 人</option>
        </select>
      </div>
      <div class="form-group">
        <label>难度</label>
        <select v-model="difficulty" class="input">
          <option value="easy">简单（加减法）</option>
          <option value="medium">中等（含乘法）</option>
          <option value="hard">困难（大数运算）</option>
          <option value="insane">疯狂（含除法）</option>
        </select>
      </div>
      <div class="form-group">
        <label>题目数量</label>
        <select v-model="questionCount" class="input">
          <option :value="5">5 题</option>
          <option :value="10">10 题</option>
          <option :value="15">15 题</option>
          <option :value="20">20 题</option>
        </select>
      </div>
      <div class="form-group">
        <label>每题限时（秒）</label>
        <select v-model="timeLimit" class="input">
          <option :value="10">10 秒</option>
          <option :value="15">15 秒</option>
          <option :value="20">20 秒</option>
          <option :value="30">30 秒</option>
        </select>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" @click="handleCreate" :disabled="game.isLoading">
          {{ game.isLoading ? '创建中...' : '创建' }}
        </button>
        <button class="btn" @click="mode = 'menu'">返回</button>
      </div>
    </div>

    <!-- 加入房间 -->
    <div v-else-if="mode === 'join'" class="lobby-form card">
      <h3>加入房间</h3>
      <div class="form-group">
        <label>房间号</label>
        <input
          v-model="joinRoomId"
          class="input"
          placeholder="输入 6 位房间号"
          maxlength="6"
          @keyup.enter="handleJoin"
        />
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" @click="handleJoin" :disabled="game.isLoading">
          {{ game.isLoading ? '加入中...' : '加入' }}
        </button>
        <button class="btn" @click="mode = 'menu'">返回</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lobby {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.lobby-hero {
  text-align: center;
  padding: 40px 0;
}

.hero-title {
  font-size: 2.5rem;
  font-weight: 900;
  color: var(--color-primary);
  text-shadow: 0 0 20px var(--color-primary), 0 0 40px var(--color-primary);
  letter-spacing: 4px;
  margin-bottom: 8px;
}

.hero-subtitle {
  color: var(--color-text-secondary);
  font-size: 1rem;
  letter-spacing: 2px;
}

.lobby-actions {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.name-input {
  width: 100%;
}

.name-input .input {
  width: 100%;
  text-align: center;
  font-size: 1.1rem;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.action-buttons .btn {
  flex: 1;
  padding: 14px;
  font-size: 1rem;
}

.action-buttons-main {
  margin-bottom: 4px;
}

.btn-quick-start {
  padding: 16px;
  font-size: 1.1rem;
  letter-spacing: 2px;
}

.lobby-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lobby-form h3 {
  font-size: 1.2rem;
  color: var(--color-primary);
  text-align: center;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.form-group .input {
  width: 100%;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.form-actions .btn {
  flex: 1;
}
</style>
