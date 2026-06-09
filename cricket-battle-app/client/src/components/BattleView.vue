/**
 * 对战视图 -- 核心对战界面，包含题目显示、答案输入、实时排行榜
 */
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { useGameStore } from '../stores/game'
import { useVoiceEngine } from '../composables/useVoiceEngine'
import { useInputProcessor } from '../composables/useInputProcessor'
import { RenderEngine } from '../engine/RenderEngine'
import { useThemeStore } from '../stores/theme'

const game = useGameStore()
const voice = useVoiceEngine()
const input = useInputProcessor()
const theme = useThemeStore()

const answerInput = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderEngine: RenderEngine | null = null
const timerProgress = ref(100)
let timerInterval: ReturnType<typeof setInterval> | null = null

const progressStyle = computed(() => ({
  width: `${timerProgress.value}%`,
  background: timerProgress.value > 50
    ? 'var(--color-primary)'
    : timerProgress.value > 20
      ? 'var(--color-warning)'
      : 'var(--color-error)',
}))

function handleSubmit(value: string) {
  const num = Number(value)
  if (isNaN(num)) return
  answerInput.value = ''
  game.submitAnswer(num)
}

input.onSubmit(handleSubmit)
input.onEscape(() => {
  if (confirm('确定要退出对战吗？')) {
    game.leaveRoom()
  }
})

onMounted(() => {
  renderEngine = new RenderEngine()
  if (canvasRef.value) {
    renderEngine.init(canvasRef.value, theme.currentTheme)
  }
  if (inputRef.value) {
    input.bindInput(inputRef.value)
    inputRef.value.focus()
  }
  voice.speak('对战开始！', 'high')
  startTimer()
})

onUnmounted(() => {
  renderEngine?.destroy()
  renderEngine = null
  input.destroy()
  stopTimer()
})

watch(() => game.currentQuestion, () => {
  timerProgress.value = 100
  stopTimer()
  startTimer()
  answerInput.value = ''
  nextTick(() => inputRef.value?.focus())
})

watch(() => game.lastAnswerResult, (result) => {
  if (!result) return

  if (result.isCorrect) {
    voice.speak('正确！', 'normal')
    if (canvasRef.value) {
      const rect = canvasRef.value.getBoundingClientRect()
      renderEngine?.playExplosion(rect.width / 2, rect.height / 2)
    }
  } else {
    voice.speak('错误！', 'normal')
    renderEngine?.playErrorFlash()
  }
})

watch(() => theme.currentTheme, (newTheme) => {
  renderEngine?.setTheme(newTheme)
})

function startTimer() {
  const timeLimit = game.currentRoom?.config?.timeLimit ?? 15
  const totalMs = timeLimit * 1000
  const startTime = Date.now()

  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime
    timerProgress.value = Math.max(0, 100 - (elapsed / totalMs) * 100)

    if (timerProgress.value <= 0) {
      stopTimer()
    }
  }, 50)
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}
</script>

<template>
  <div class="battle">
    <!-- 背景 Canvas -->
    <canvas ref="canvasRef" class="battle-canvas"></canvas>

    <!-- 顶部信息栏 -->
    <div class="battle-header">
      <div class="question-progress">
        题目 {{ (game.currentQuestion?.index ?? 0) + 1 }} / {{ game.currentRoom?.config?.questionCount }}
      </div>
      <div class="timer-bar">
        <div class="timer-fill" :style="progressStyle"></div>
      </div>
    </div>

    <!-- 题目区域 -->
    <div class="question-area">
      <div class="question-expression">
        {{ game.currentQuestion?.expression ?? '...' }}
      </div>
      <div class="question-equals">=</div>
    </div>

    <!-- 答案输入 -->
    <div class="answer-area">
      <input
        ref="inputRef"
        v-model="answerInput"
        class="answer-input"
        type="number"
        placeholder="输入答案"
        inputmode="numeric"
        autocomplete="off"
      />
      <button class="btn btn-primary submit-btn" @click="handleSubmit(answerInput)">
        提交
      </button>
    </div>
    <p class="input-hint">按 Enter 提交答案，按 Esc 退出</p>

    <!-- 上一题结果 -->
    <div v-if="game.lastAnswerResult" class="last-result" :class="game.lastAnswerResult.isCorrect ? 'correct' : 'wrong'">
      <span v-if="game.lastAnswerResult.isCorrect">正确！</span>
      <span v-else>错误！正确答案: {{ game.lastAnswerResult.correctAnswer }}</span>
    </div>

    <!-- 实时排行榜 -->
    <div class="leaderboard">
      <h3>排行榜</h3>
      <div
        v-for="entry in game.rankings"
        :key="entry.playerId"
        class="rank-entry"
        :class="{ 'is-self': entry.playerId === game.playerId, 'is-first': entry.rank === 1 }"
      >
        <span class="rank-num">#{{ entry.rank }}</span>
        <span class="rank-name">{{ entry.playerName }}</span>
        <span class="rank-score">{{ entry.score }} 分</span>
        <span class="rank-correct">{{ entry.correctCount }} 正确</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.battle {
  width: 100%;
  max-width: 700px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: relative;
}

.battle-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 100;
}

.battle-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.question-progress {
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  text-align: center;
  letter-spacing: 1px;
}

.timer-bar {
  width: 100%;
  height: 4px;
  background: var(--color-surface);
  border-radius: 2px;
  overflow: hidden;
}

.timer-fill {
  height: 100%;
  transition: width 0.05s linear, background 0.3s ease;
  border-radius: 2px;
  box-shadow: 0 0 8px currentColor;
}

.question-area {
  text-align: center;
  padding: 32px 0;
}

.question-expression {
  font-size: 3rem;
  font-weight: 900;
  color: var(--color-primary);
  text-shadow: 0 0 15px var(--color-primary);
  letter-spacing: 4px;
  font-family: 'Orbitron', monospace;
}

.question-equals {
  font-size: 2rem;
  color: var(--color-text-secondary);
  margin-top: 8px;
}

.answer-area {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.answer-input {
  background: var(--color-background);
  border: 2px solid var(--color-primary);
  color: var(--color-text);
  padding: 14px 20px;
  border-radius: 4px;
  font-family: 'Orbitron', monospace;
  font-size: 1.5rem;
  font-weight: 700;
  text-align: center;
  width: 200px;
  outline: none;
  transition: box-shadow 0.2s ease;
}

.answer-input:focus {
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.3);
}

/* 隐藏 number input 的箭头 */
.answer-input::-webkit-inner-spin-button,
.answer-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.answer-input[type=number] {
  -moz-appearance: textfield;
}

.submit-btn {
  padding: 14px 28px;
  font-size: 1.1rem;
}

.input-hint {
  text-align: center;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin-top: -8px;
}

.last-result {
  text-align: center;
  font-size: 1.1rem;
  font-weight: 700;
  padding: 12px;
  border-radius: 4px;
  animation: fadeIn 0.3s ease;
}

.last-result.correct {
  color: var(--color-success);
  background: rgba(0, 255, 136, 0.1);
  border: 1px solid var(--color-success);
}

.last-result.wrong {
  color: var(--color-error);
  background: rgba(255, 51, 102, 0.1);
  border: 1px solid var(--color-error);
}

.leaderboard {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.leaderboard h3 {
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.rank-entry {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--color-surface);
  border-radius: 4px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.rank-entry.is-self {
  border-color: var(--color-primary);
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.1);
}

.rank-entry.is-first .rank-num {
  color: var(--color-warning);
  text-shadow: 0 0 8px var(--color-warning);
}

.rank-num {
  font-weight: 900;
  min-width: 36px;
  color: var(--color-text-secondary);
}

.rank-name {
  flex: 1;
  font-weight: 700;
}

.rank-score {
  color: var(--color-primary);
  font-weight: 700;
  min-width: 60px;
  text-align: right;
}

.rank-correct {
  color: var(--color-success);
  font-size: 0.9rem;
  min-width: 50px;
  text-align: right;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
