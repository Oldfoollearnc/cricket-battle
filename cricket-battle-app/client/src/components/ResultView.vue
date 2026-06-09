/**
 * 结果视图 -- 对战结束后显示战绩和统计数据
 */
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useGameStore } from '../stores/game'
import { usePlayerStatsStore } from '../stores/playerStats'
import { useVoiceEngine } from '../composables/useVoiceEngine'

const game = useGameStore()
const stats = usePlayerStatsStore()
const voice = useVoiceEngine()

const myResult = computed(() =>
  game.battleResults.find((r) => r.playerId === game.playerId)
)

const sortedResults = computed(() =>
  [...game.battleResults].sort((a, b) => b.score - a.score)
)

const isWinner = computed(() => myResult.value?.isWinner ?? false)
const isDraw = computed(() => myResult.value?.isDraw ?? false)

onMounted(() => {
  // 记录战绩
  for (const result of game.battleResults) {
    if (result.playerId === game.playerId) {
      stats.recordMatch(result)
    }
  }

  // 语音播报
  if (isDraw.value) {
    voice.speak('平局！势均力敌！', 'high')
  } else if (isWinner.value) {
    voice.speak('恭喜你获胜了！', 'high')
  } else {
    voice.speak('对战结束，再接再厉！', 'normal')
  }
})

function formatTime(ms: number): string {
  if (ms === 0 || !isFinite(ms)) return '-'
  return `${(ms / 1000).toFixed(2)}s`
}

function formatAccuracy(correct: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((correct / total) * 100)}%`
}
</script>

<template>
  <div class="result">
    <!-- 胜负标题 -->
    <div class="result-banner" :class="{ winner: isWinner, draw: isDraw }">
      <h2>{{ isDraw ? '平局！' : isWinner ? '胜利!' : '再接再厉!' }}</h2>
      <p v-if="myResult" class="result-score">{{ myResult.score }} 分</p>
    </div>

    <!-- 排行榜 -->
    <div class="result-ranking">
      <h3>最终排名</h3>
      <div
        v-for="(result, index) in sortedResults"
        :key="result.playerId"
        class="rank-card card"
        :class="{
          'is-self': result.playerId === game.playerId,
          'is-winner': index === 0,
        }"
      >
        <div class="rank-position">#{{ index + 1 }}</div>
        <div class="rank-info">
          <div class="rank-player-name">
            {{ result.playerName }}
            <span v-if="result.playerId === game.playerId" class="you-badge">你</span>
            <span v-if="result.isDraw" class="draw-badge">平局</span>
            <span v-else-if="result.isWinner && index === 0" class="winner-badge">胜</span>
          </div>
          <div class="rank-details">
            <span>{{ result.score }} 分</span>
            <span>{{ result.correctCount }}/{{ result.totalQuestions }} 正确</span>
            <span>平均 {{ formatTime(result.avgResponseTime) }}</span>
          </div>
        </div>
        <div class="rank-accuracy">
          {{ formatAccuracy(result.correctCount, result.totalQuestions) }}
        </div>
      </div>
    </div>

    <!-- 个人统计 -->
    <div class="personal-stats card">
      <h3>你的战绩</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-value">{{ stats.stats.totalMatches }}</span>
          <span class="stat-label">总场次</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.winRatePercent }}%</span>
          <span class="stat-label">胜率</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.stats.currentStreak }}</span>
          <span class="stat-label">当前连胜</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.stats.bestStreak }}</span>
          <span class="stat-label">最高连胜</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ formatTime(stats.stats.bestTime) }}</span>
          <span class="stat-label">最快时间</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ formatTime(stats.stats.avgResponseTime) }}</span>
          <span class="stat-label">平均响应</span>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="result-actions">
      <button v-if="game.isHost" class="btn btn-primary" @click="game.restartBattle()">
        再来一局
      </button>
      <button class="btn" @click="game.backToLobby()">返回大厅</button>
    </div>
  </div>
</template>

<style scoped>
.result {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.result-banner {
  text-align: center;
  padding: 32px;
  border-radius: 8px;
  background: var(--color-surface);
  border: 2px solid var(--color-text-secondary);
}

.result-banner.winner {
  border-color: var(--color-warning);
  background: linear-gradient(135deg, var(--color-surface), rgba(255, 170, 0, 0.1));
}

.result-banner.draw {
  border-color: var(--color-primary);
  background: linear-gradient(135deg, var(--color-surface), rgba(0, 240, 255, 0.1));
}

.result-banner.draw h2 {
  color: var(--color-primary);
  text-shadow: 0 0 15px var(--color-primary);
}

.result-banner h2 {
  font-size: 2rem;
  font-weight: 900;
  margin-bottom: 8px;
}

.result-banner.winner h2 {
  color: var(--color-warning);
  text-shadow: 0 0 15px var(--color-warning);
}

.result-score {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-primary);
}

.result-ranking {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-ranking h3 {
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.rank-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
}

.rank-card.is-self {
  border-color: var(--color-primary);
}

.rank-card.is-winner {
  border-color: var(--color-warning);
}

.rank-position {
  font-size: 1.3rem;
  font-weight: 900;
  min-width: 40px;
  color: var(--color-text-secondary);
}

.rank-card.is-winner .rank-position {
  color: var(--color-warning);
  text-shadow: 0 0 8px var(--color-warning);
}

.rank-info {
  flex: 1;
}

.rank-player-name {
  font-weight: 700;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.you-badge {
  font-size: 0.7rem;
  background: var(--color-primary);
  color: var(--color-background);
  padding: 1px 6px;
  border-radius: 2px;
  font-weight: 700;
}

.draw-badge {
  font-size: 0.7rem;
  background: var(--color-primary);
  color: var(--color-background);
  padding: 1px 6px;
  border-radius: 2px;
  font-weight: 700;
}

.winner-badge {
  font-size: 0.7rem;
  background: var(--color-warning);
  color: var(--color-background);
  padding: 1px 6px;
  border-radius: 2px;
  font-weight: 700;
}

.rank-details {
  display: flex;
  gap: 12px;
  margin-top: 4px;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.rank-accuracy {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-success);
}

.personal-stats {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.personal-stats h3 {
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 1.3rem;
  font-weight: 900;
  color: var(--color-primary);
}

.stat-label {
  display: block;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.result-actions {
  display: flex;
  justify-content: center;
}

.result-actions .btn {
  min-width: 200px;
  padding: 14px 32px;
  font-size: 1rem;
}
</style>
