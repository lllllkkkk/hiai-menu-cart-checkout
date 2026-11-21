<script setup>
import { onMounted } from 'vue'
import { useCart } from './cart'

const { state, loadCart } = useCart()
onMounted(loadCart)
</script>

<template>
  <div class="app-shell">
    <!-- L4 后端重启友好提示（黄色 info）+ N10 关闭按钮 -->
    <div v-if="state.info" class="global-info" role="status">
      <span>{{ state.info }}</span>
      <button class="global-tip-close" aria-label="关闭提示" @click="state.info = ''">×</button>
    </div>
    <!-- 阻断性错误（红色 error）+ N10 关闭按钮 -->
    <div v-if="state.error" class="global-error" role="alert">
      <span>{{ state.error }}</span>
      <button class="global-tip-close" aria-label="关闭错误提示" @click="state.error = ''">×</button>
    </div>
    <router-view />
  </div>
</template>

<style>
.global-info, .global-error {
  position: fixed; top: 12px; left: 50%; z-index: 1001;
  width: min(calc(100% - 32px), 508px); padding: 11px 14px;
  transform: translateX(-50%);
  border-radius: 12px; font-size: 13px;
  box-shadow: 0 8px 22px rgba(0,0,0,.12);
  animation: slideDown .25s ease;
  display: flex; align-items: center; gap: 10px;
}
.global-info {
  border: 1px solid #fcd34d;
  background: #fffbeb; color: #92400e;
  box-shadow: 0 8px 22px rgba(252,211,77,.25);
}
.global-error {
  border: 1px solid #efc6bd;
  background: #fff3ef; color: #8f241c;
}
.global-tip-close {
  margin-left: auto; width: 26px; height: 26px; flex-shrink: 0;
  padding: 0; border-radius: 50%;
  background: rgba(0,0,0,.06); color: inherit; font-size: 16px; line-height: 26px;
  transition: background .15s;
}
.global-tip-close:hover { background: rgba(0,0,0,.14); }
</style>
