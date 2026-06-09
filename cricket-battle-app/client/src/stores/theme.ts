/**
 * 主题管理 Store -- Pinia store，管理主题切换和自定义主题
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ThemeConfig } from '@shared/types'

const STORAGE_KEY = 'cricket-battle-theme'
const CUSTOM_THEMES_KEY = 'cricket-battle-custom-themes'

const BUILT_IN_THEMES: ThemeConfig[] = [
  {
    name: 'cyberpunk',
    label: '赛博朋克',
    colors: {
      primary: '#00f0ff',
      secondary: '#ff00aa',
      background: '#0a0a1a',
      surface: '#1a1a2e',
      text: '#e0e0ff',
      textSecondary: '#8888aa',
      success: '#00ff88',
      error: '#ff3366',
      warning: '#ffaa00',
      accent: '#ff00aa',
    },
    fontFamily: "'Orbitron', 'Noto Sans SC', sans-serif",
    particleStyle: 'explosion',
    isCustom: false,
  },
  {
    name: 'pixel',
    label: '像素复古',
    colors: {
      primary: '#4ecdc4',
      secondary: '#ff6b6b',
      background: '#2d2d2d',
      surface: '#3d3d3d',
      text: '#f0f0f0',
      textSecondary: '#a0a0a0',
      success: '#7dff7d',
      error: '#ff5555',
      warning: '#ffff55',
      accent: '#ff6b6b',
    },
    fontFamily: "'Press Start 2P', 'Noto Sans SC', monospace",
    particleStyle: 'pixel',
    isCustom: false,
  },
  {
    name: 'minimal',
    label: '极简主义',
    colors: {
      primary: '#000000',
      secondary: '#666666',
      background: '#ffffff',
      surface: '#f5f5f5',
      text: '#1a1a1a',
      textSecondary: '#888888',
      success: '#22c55e',
      error: '#ef4444',
      warning: '#f59e0b',
      accent: '#666666',
    },
    fontFamily: "'Noto Sans SC', sans-serif",
    particleStyle: 'minimal',
    isCustom: false,
  },
]

export const useThemeStore = defineStore('theme', () => {
  const currentThemeName = ref<string>(loadCurrentTheme())
  const customThemes = ref<ThemeConfig[]>(loadCustomThemes())

  function loadCurrentTheme(): string {
    return localStorage.getItem(STORAGE_KEY) || 'cyberpunk'
  }

  function loadCustomThemes(): ThemeConfig[] {
    const stored = localStorage.getItem(CUSTOM_THEMES_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        // corrupted
      }
    }
    return []
  }

  const allThemes = computed<ThemeConfig[]>(() => [...BUILT_IN_THEMES, ...customThemes.value])

  const currentTheme = computed<ThemeConfig>(() => {
    return allThemes.value.find((t) => t.name === currentThemeName.value) ?? BUILT_IN_THEMES[0]
  })

  function applyTheme(name: string): void {
    const theme = allThemes.value.find((t) => t.name === name)
    if (!theme) return

    currentThemeName.value = name
    localStorage.setItem(STORAGE_KEY, name)

    // 应用 CSS 变量
    const root = document.documentElement
    const colors = theme.colors
    root.style.setProperty('--color-primary', colors.primary)
    root.style.setProperty('--color-secondary', colors.secondary)
    root.style.setProperty('--color-background', colors.background)
    root.style.setProperty('--color-surface', colors.surface)
    root.style.setProperty('--color-text', colors.text)
    root.style.setProperty('--color-text-secondary', colors.textSecondary)
    root.style.setProperty('--color-success', colors.success)
    root.style.setProperty('--color-error', colors.error)
    root.style.setProperty('--color-warning', colors.warning)
    root.style.setProperty('--color-accent', colors.accent)
    root.style.setProperty('--font-family', theme.fontFamily)
  }

  function saveCustomTheme(theme: ThemeConfig): void {
    theme.isCustom = true
    const existing = customThemes.value.findIndex((t) => t.name === theme.name)
    if (existing >= 0) {
      customThemes.value[existing] = theme
    } else {
      customThemes.value.push(theme)
    }
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(customThemes.value))
  }

  function deleteCustomTheme(name: string): void {
    customThemes.value = customThemes.value.filter((t) => t.name !== name)
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(customThemes.value))
    if (currentThemeName.value === name) {
      applyTheme('cyberpunk')
    }
  }

  // 初始化时应用当前主题
  applyTheme(currentThemeName.value)

  return {
    currentThemeName,
    currentTheme,
    allThemes,
    customThemes,
    applyTheme,
    saveCustomTheme,
    deleteCustomTheme,
  }
})
