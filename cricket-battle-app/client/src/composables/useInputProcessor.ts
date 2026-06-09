/**
 * 输入处理 -- 统一处理键盘/触屏输入，防抖、快捷键
 */

import { ref, readonly, onUnmounted } from 'vue'

export function useInputProcessor() {
  const isInputEnabled = ref(true)
  let submitCallback: ((value: string) => void) | null = null
  let escapeCallback: (() => void) | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function handleKeyDown(e: KeyboardEvent): void {
    if (!isInputEnabled.value) return

    if (e.key === 'Enter') {
      e.preventDefault()
      const input = e.target as HTMLInputElement
      if (input?.value?.trim()) {
        debouncedSubmit(input.value.trim())
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      escapeCallback?.()
    }
  }

  function debouncedSubmit(value: string): void {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      submitCallback?.(value)
    }, 50)
  }

  function bindInput(element: HTMLElement): void {
    element.addEventListener('keydown', handleKeyDown)
  }

  function unbindInput(element: HTMLElement): void {
    element.removeEventListener('keydown', handleKeyDown)
  }

  function onSubmit(callback: (value: string) => void): void {
    submitCallback = callback
  }

  function onEscape(callback: () => void): void {
    escapeCallback = callback
  }

  function setInputEnabled(enabled: boolean): void {
    isInputEnabled.value = enabled
  }

  function destroy(): void {
    if (debounceTimer) clearTimeout(debounceTimer)
    submitCallback = null
    escapeCallback = null
  }

  onUnmounted(destroy)

  return {
    isInputEnabled: readonly(isInputEnabled),
    bindInput,
    unbindInput,
    onSubmit,
    onEscape,
    setInputEnabled,
    destroy,
  }
}
