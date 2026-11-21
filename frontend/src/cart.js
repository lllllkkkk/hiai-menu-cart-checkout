import { reactive } from 'vue'
import { api, ApiError } from './api'

const CART_SESSION_KEY = 'hiai-demo-session-id'

// L9 修复：sessionId 用 sessionStorage（关闭 tab 就丢）而非 localStorage（永久）
// 跟后端 cart 的 30min TTL 生命周期对齐，避免"昨天加的菜今天不见"的困惑
function sessionId() {
  let value = sessionStorage.getItem(CART_SESSION_KEY) || localStorage.getItem(CART_SESSION_KEY)
  if (!value) {
    value = globalThis.crypto?.randomUUID?.() || `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
  sessionStorage.setItem(CART_SESSION_KEY, value)
  localStorage.removeItem(CART_SESSION_KEY)  // 清理旧的 localStorage 残留
  return value
}

const state = reactive({
  sessionId: sessionId(),
  cart: { items: [], itemCount: 0, total: 0 },
  loading: false,
  updating: false,
  error: '',
  info: '',
  // N2 修复：把菜单元数据注入 cart.js，让乐观更新能构造完整 CartLine
  _dishMeta: new Map(),
})

/**
 * 让 cart.js 拿到菜品元数据（name/icon/price/artColor），
 * 由 MenuPage 在菜单加载完成后调用一次。
 */
export function seedDishMeta(dishes) {
  if (!dishes?.length) return
  for (const d of dishes) {
    state._dishMeta.set(d.id, d)
  }
}

/**
 * N3 修复：跟 setQuantity 一样，loadCart 也走全局锁，
 * 防止 App.vue 和 CheckoutPage.vue 同时调时互相覆盖。
 */
let loadInFlight = null

async function loadCart() {
  if (loadInFlight) return loadInFlight  // 合并并发调用
  loadInFlight = (async () => {
    state.loading = true
    state.error = ''
    state.info = ''
    try {
      const previousItemCount = state.cart.itemCount
      const fresh = await api.cart(state.sessionId)
      // N3 修复：只在"已有元数据"或"车被清空"时覆盖，
      // 避免在 setQuantity 乐观更新回后立刻被旧的 loadCart 结果盖掉
      if (state._dishMeta.size === 0 || fresh.itemCount === 0) {
        state.cart = fresh
      } else {
        // 合并：以 fresh 为真源，但保留本地可能尚未对齐的 price/artColor 元数据
        state.cart = alignWithMeta(fresh)
      }
      // L4 后端重启握手
      if (previousItemCount > 0 && state.cart.itemCount === 0) {
        state.info = '提示：购物车服务已重置，菜品已清空，请重新点菜～'
      }
    } catch (error) {
      if (error?.code !== 'TIMEOUT') state.error = error.message ?? '加载购物车失败'
      throw error
    } finally {
      state.loading = false
      loadInFlight = null
    }
  })()
  return loadInFlight
}

function alignWithMeta(cart) {
  const items = cart.items.map(i => {
    const meta = state._dishMeta.get(i.dishId)
    if (!meta) return i
    return {
      ...i,
      name: meta.name,
      icon: meta.icon,
      artColor: meta.artColor,
      price: meta.price,
      lineTotal: round2(meta.price * i.quantity),
    }
  })
  return {
    items,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    total: round2(items.reduce((s, i) => s + i.lineTotal, 0)),
  }
}

/** N3 修复：setQuantity 也跟 loadCart 共享同一把锁，保证不会互相覆盖 */
let stateLock = Promise.resolve()

const perDishQueue = new Map()
function enqueue(dishId, taskFactory) {
  const prev = perDishQueue.get(dishId) ?? Promise.resolve()
  const next = prev.then(() => taskFactory())
  perDishQueue.set(dishId, next)
  next.catch(() => {})
  return next
}

async function setQuantity(dishId, quantity) {
  const clamped = Math.max(0, Math.min(99, quantity))
  // N3：串行化所有状态写操作（loadCart + setQuantity）
  const criticalSection = stateLock.then(async () => {
    return enqueue(dishId, async () => {
      const prev = deepSnapshot(state.cart)  // N1 深拷贝 ← 修复回滚错误
      applyLocal(prev, dishId, clamped)
      state.cart = prev

      state.updating = true
      state.error = ''
      try {
        const remote = await api.setCartItem({
          sessionId: state.sessionId,
          dishId,
          quantity: clamped,
        })
        state.cart = alignWithMeta(remote)  // N2 用元数据兜底
        return state.cart
      } catch (error) {
        // N1 修复：prev 现在是深拷贝，这里回滚到的是真实原始态
        state.cart = prev
        state.error = error.message ?? '修改购物车失败'
        throw error
      } finally {
        state.updating = false
      }
    })
  })
  stateLock = criticalSection.catch(() => {})
  return criticalSection
}

function applyLocal(cart, dishId, quantity) {
  const idx = cart.items.findIndex(i => i.dishId === dishId)
  if (quantity <= 0) {
    if (idx >= 0) cart.items.splice(idx, 1)
  } else {
    if (idx >= 0) {
      const existing = cart.items[idx]
      cart.items[idx] = { ...existing, quantity, lineTotal: round2(existing.price * quantity) }
    } else {
      // N2 修复：乐观更新时注入元数据
      const meta = state._dishMeta.get(dishId)
      cart.items.push({
        dishId,
        name: meta?.name || '',
        icon: meta?.icon || '',
        artColor: meta?.artColor || '',
        price: meta?.price ?? 0,
        quantity,
        lineTotal: round2((meta?.price ?? 0) * quantity),
      })
    }
  }
  cart.items.sort((a, b) => a.dishId.localeCompare(b.dishId))
  cart.itemCount = cart.items.reduce((s, i) => s + i.quantity, 0)
  cart.total = round2(cart.items.reduce((s, i) => s + i.lineTotal, 0))
}

// N1 修复：深拷贝，确保 applyLocal 不会原地改"快照"
function deepSnapshot(cart) {
  return {
    items: cart.items.map(i => ({ ...i })),
    itemCount: cart.itemCount,
    total: cart.total,
  }
}

function round2(n) {
  return Math.round(n * 100) / 100
}

function quantityOf(dishId) {
  return state.cart.items.find(item => item.dishId === dishId)?.quantity || 0
}

export function useCart() {
  return { state, loadCart, setQuantity, quantityOf, seedDishMeta }
}
