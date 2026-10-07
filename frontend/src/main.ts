import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import { useAppStore } from './stores/app'
import './styles/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus)

const appStore = useAppStore(pinia)

await appStore.fetchSettings().catch((error) => {
  console.warn('[settings] failed to load settings during bootstrap:', error)
})

app.mount('#app')
