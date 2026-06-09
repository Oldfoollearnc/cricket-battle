/**
 * 根组件 -- 根据游戏状态切换不同视图
 */
<script setup lang="ts">
import { onMounted } from 'vue'
import { useGameStore } from './stores/game'
import { useThemeStore } from './stores/theme'
import LobbyView from './components/LobbyView.vue'
import RoomView from './components/RoomView.vue'
import BattleView from './components/BattleView.vue'
import ResultView from './components/ResultView.vue'

const game = useGameStore()
const theme = useThemeStore()

onMounted(async () => {
  await game.connect()

  // 消费分享链接：从 URL 路径提取 roomId 并自动加入
  const pathMatch = window.location.pathname.match(/^\/room\/([A-Z0-9]{6})$/)
  if (pathMatch) {
    const roomId = pathMatch[1]
    const savedName = localStorage.getItem('cricket-player-name')
    if (savedName && !game.currentRoom) {
      try {
        await game.joinRoom(roomId, savedName)
        window.history.replaceState(null, '', '/')
      } catch {
        // 加入失败不阻塞主流程
      }
    }
  }
})
</script>

<template>
  <div class="app" :class="[`theme-${theme.currentThemeName}`]">
    <header class="app-header">
      <h1 class="app-title">Cricket Battle</h1>
      <div class="theme-selector">
        <select :value="theme.currentThemeName" @change="theme.applyTheme(($event.target as HTMLSelectElement).value)">
          <option v-for="t in theme.allThemes" :key="t.name" :value="t.name">
            {{ t.label }}
          </option>
        </select>
      </div>
    </header>

    <main class="app-main">
      <LobbyView v-if="game.view === 'lobby'" />
      <RoomView v-else-if="game.view === 'room'" />
      <BattleView v-else-if="game.view === 'battle'" />
      <ResultView v-else-if="game.view === 'result'" />
    </main>

    <div v-if="game.error" class="error-toast" @click="game.error = null">
      {{ game.error }}
    </div>
  </div>
</template>

<style>
:root {
  --color-primary: #00f0ff;
  --color-secondary: #ff00aa;
  --color-background: #0a0a1a;
  --color-surface: #1a1a2e;
  --color-text: #e0e0ff;
  --color-text-secondary: #8888aa;
  --color-success: #00ff88;
  --color-error: #ff3366;
  --color-warning: #ffaa00;
  --color-accent: #ff00aa;
  --font-family: 'Orbitron', 'Noto Sans SC', sans-serif;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: var(--color-background);
  color: var(--color-text);
  font-family: var(--font-family);
  min-height: 100vh;
  overflow-x: hidden;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-surface);
  background: var(--color-surface);
}

.app-title {
  font-size: 1.5rem;
  font-weight: 900;
  color: var(--color-primary);
  text-shadow: 0 0 10px var(--color-primary);
  letter-spacing: 2px;
}

.theme-selector select {
  background: var(--color-background);
  color: var(--color-text);
  border: 1px solid var(--color-primary);
  padding: 6px 12px;
  border-radius: 4px;
  font-family: var(--font-family);
  font-size: 0.9rem;
  cursor: pointer;
}

.app-main {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 24px;
}

.error-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-error);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* 通用按钮样式 */
.btn {
  padding: 10px 24px;
  border: 2px solid var(--color-primary);
  background: transparent;
  color: var(--color-primary);
  font-family: var(--font-family);
  font-size: 0.9rem;
  font-weight: 700;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.btn:hover {
  background: var(--color-primary);
  color: var(--color-background);
  box-shadow: 0 0 15px var(--color-primary);
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: var(--color-background);
}

.btn-primary:hover {
  box-shadow: 0 0 20px var(--color-primary);
}

.btn-danger {
  border-color: var(--color-error);
  color: var(--color-error);
}

.btn-danger:hover {
  background: var(--color-error);
  color: white;
  box-shadow: 0 0 15px var(--color-error);
}

.btn-success {
  border-color: var(--color-success);
  color: var(--color-success);
}

.btn-success:hover {
  background: var(--color-success);
  color: var(--color-background);
  box-shadow: 0 0 15px var(--color-success);
}

/* 通用输入框 */
.input {
  background: var(--color-background);
  border: 2px solid var(--color-surface);
  color: var(--color-text);
  padding: 10px 16px;
  border-radius: 4px;
  font-family: var(--font-family);
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s ease;
}

.input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
}

.input::placeholder {
  color: var(--color-text-secondary);
}

/* 卡片 */
.card {
  background: var(--color-surface);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 20px;
}
</style>
