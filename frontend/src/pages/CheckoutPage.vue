<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, ApiError } from '../api'
import { useCart } from '../cart'

const router = useRouter()
const { state, loadCart } = useCart()
const preview = ref(null)
const selectedMethod = ref('wechat_demo')
const loading = ref(true)
const error = ref('')
const cartGone = ref(false)  // L4 后端重启 / L6 脏 ID 导致购物车丢失
const demoEnded = ref(false)
const itemsExpanded = ref(true)

async function loadPreview() {
  loading.value = true
  error.value = ''
  cartGone.value = false
  try {
    // 确保后端最新车数据（防 L4 重启丢失）
    await loadCart()
    // L6：如果后端车已空，直接走友好回退
    if (state.cart.itemCount === 0) {
      cartGone.value = true
      return
    }
    let selectedDishIds = []
    try {
      selectedDishIds = JSON.parse(sessionStorage.getItem('hiai-demo-selected-dish-ids') || '[]')
      if (!Array.isArray(selectedDishIds)) selectedDishIds = []
    } catch (_) { selectedDishIds = [] }

    // L6 防御：过滤掉不在当前车中的脏 ID
    const currentIds = new Set(state.cart.items.map(i => i.dishId))
    selectedDishIds = selectedDishIds.filter(id => currentIds.has(id))

    // 如果 sessionStorage 有脏 ID 全被过滤掉，退化为"全车结算"
    preview.value = await api.checkoutPreview(state.sessionId, selectedDishIds)
    selectedMethod.value = preview.value.paymentMethods[0]?.code || ''
  } catch (err) {
    if (err instanceof ApiError && err.status === 400) {
      // L4 / L6：购物车已空或无效 → 友好回退
      cartGone.value = true
    } else {
      error.value = err.message
    }
  } finally {
    loading.value = false
  }
}

function finishDemo() {
  demoEnded.value = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(loadPreview)
</script>

<template>
  <section class="pay-page">
    <header class="simple-nav pay-nav">
      <router-link to="/" class="back-button" aria-label="返回点餐">‹</router-link>
      <strong>支付订单</strong>
      <span></span>
    </header>

    <div v-if="loading" class="full-state"><div class="loader"></div><p>正在核对订单金额…</p></div>

    <!-- L4/L6 购物车丢失友好回退 -->
    <div v-else-if="cartGone" class="empty-card cart-gone-state">
      <div class="state-sign warning">🍽️</div>
      <h1>购物车里暂时没有菜品了</h1>
      <p class="cart-gone-hint">可能是服务刚刚刷新了数据，或者您选择的菜品已不在车中。</p>
      <router-link to="/" class="plain-primary">返回点餐</router-link>
    </div>

    <div v-else-if="error" class="empty-card"><div class="state-sign">!</div><h1>暂时无法结算</h1><p>{{ error }}</p><button class="plain-primary" @click="loadPreview">重新加载</button></div>
    <div v-else-if="demoEnded" class="empty-card demo-complete"><div class="state-sign success">✓</div><h1>流程演示到这里结束</h1><p>没有创建真实支付单，也没有调用微信或其他扣款接口。</p><router-link to="/" class="plain-primary">返回点餐</router-link></div>

    <template v-else-if="preview">
      <section class="pay-amount-card">
        <span class="pay-amount-label">本次待付</span>
        <div class="pay-amount-value"><span>¥</span>{{ preview.total.toFixed(2) }}</div>
        <span class="pay-amount-context">共 {{ preview.itemCount }} 件菜品</span>
      </section>

      <section class="demo-boundary"><span>演示环境</span><p>页面保留至付款确认，不会发起真实交易。</p></section>

      <section class="items-card">
        <header class="items-hd"><strong>本次结账菜品</strong><span>共 {{ preview.itemCount }} 件</span></header>
        <template v-if="itemsExpanded">
          <div v-for="item in preview.items" :key="item.dishId" class="items-row">
            <span class="items-name">{{ item.name }}</span><span class="items-qty">×{{ item.quantity }}</span><strong>¥{{ item.lineTotal.toFixed(2) }}</strong>
          </div>
        </template>
        <button class="items-toggle" @click="itemsExpanded = !itemsExpanded">{{ itemsExpanded ? '收起菜品明细' : '查看菜品明细' }} <span>{{ itemsExpanded ? '⌃' : '⌄' }}</span></button>
      </section>

      <section class="payment-methods">
        <header class="payment-section-head"><div><strong>支付方式</strong><span>请选择本次支付方式</span></div></header>
        <div class="payment-options">
          <label v-for="method in preview.paymentMethods" :key="method.code" class="method-select">
            <span class="method-icon" :class="{ wechat: method.code === 'wechat_demo' }">{{ method.code === 'wechat_demo' ? '微' : '店' }}</span>
            <span class="method-copy"><strong>{{ method.label }}</strong><small>{{ method.description }}</small></span>
            <input v-model="selectedMethod" :value="method.code" type="radio" />
            <i class="selection-indicator" :class="{ selected: selectedMethod === method.code }">✓</i>
          </label>
        </div>
      </section>

      <footer class="pay-footer">
        <div class="footer-total"><span>本次合计</span><strong>¥{{ preview.total.toFixed(2) }}</strong></div>
        <button class="pay-btn" @click="finishDemo">确认支付 ¥{{ preview.total.toFixed(2) }}</button>
      </footer>
    </template>
  </section>
</template>

<style>
.state-sign.warning { background: #fef3c7; color: #92400e; }
.cart-gone-hint { font-size: 13px; color: #6b5648; line-height: 1.6; }
</style>
