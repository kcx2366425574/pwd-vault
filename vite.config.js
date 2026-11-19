import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// HBuilderX / Vite 标准 uni-app Vue3 工程配置
export default defineConfig({
  plugins: [uni()]
})
