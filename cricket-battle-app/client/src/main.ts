/**
 * 应用入口 -- 初始化 Vue 应用和 Pinia 状态管理
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
