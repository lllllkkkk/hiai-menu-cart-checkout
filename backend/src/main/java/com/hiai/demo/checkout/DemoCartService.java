package com.hiai.demo.checkout;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
class DemoCartService {

    /** 单个演示进程最多保留的会话数，超过会清理最旧的 */
    private static final int MAX_SESSIONS = 2000;

    /** 超过 30 分钟未访问的会话视为过期，惰性清理 */
    private static final long TTL_MS = 30L * 60 * 1000;

    private final Map<String, Map<String, Integer>> carts = new ConcurrentHashMap<>();

    /** 每个 sessionId 最后一次写入/访问的时间戳（ms） */
    private final Map<String, Long> lastAccessAt = new ConcurrentHashMap<>();

    CartView get(String sessionId) {
        validateSession(sessionId);
        Map<String, Integer> quantities = carts.getOrDefault(sessionId, Map.of());
        List<CartLine> items = new ArrayList<>();
        quantities.forEach((dishId, quantity) -> {
            DemoCatalog.Dish dish = DemoCatalog.DISH_BY_ID.get(dishId);
            if (dish != null && quantity > 0) {
                items.add(new CartLine(dish.id(), dish.name(), dish.icon(), dish.artColor(), dish.price(), quantity,
                        dish.price().multiply(BigDecimal.valueOf(quantity))));
            }
        });
        items.sort(Comparator.comparing(CartLine::dishId));
        int itemCount = items.stream().mapToInt(CartLine::quantity).sum();
        BigDecimal total = items.stream().map(CartLine::lineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new CartView(List.copyOf(items), itemCount, total);
    }

    CartView setQuantity(String sessionId, String dishId, int quantity) {
        validateSession(sessionId);
        if (!DemoCatalog.DISH_BY_ID.containsKey(dishId)) {
            throw new IllegalArgumentException("菜品不存在或已下架");
        }
        if (quantity < 0 || quantity > 99) {
            throw new IllegalArgumentException("菜品数量必须在 0 到 99 之间");
        }
        Map<String, Integer> cart = carts.computeIfAbsent(sessionId, ignored -> new ConcurrentHashMap<>());
        if (quantity == 0) cart.remove(dishId);
        else cart.put(dishId, quantity);
        if (cart.isEmpty()) {
            carts.remove(sessionId);
            lastAccessAt.remove(sessionId);
        } else {
            touch(sessionId);
            evictStaleAndEnforceCap();
        }
        return get(sessionId);
    }

    private void touch(String sessionId) {
        lastAccessAt.put(sessionId, System.currentTimeMillis());
    }

    /** 惰性清理：删除过期 session + 容量兜底。每次写入时调用。 */
    private void evictStaleAndEnforceCap() {
        long now = System.currentTimeMillis();
        List<String> stale = new ArrayList<>();
        lastAccessAt.forEach((sid, ts) -> {
            if (now - ts > TTL_MS) stale.add(sid);
        });
        for (String sid : stale) {
            carts.remove(sid);
            lastAccessAt.remove(sid);
        }
        // 容量兜底：超上限时清最旧的
        if (carts.size() > MAX_SESSIONS) {
            lastAccessAt.entrySet().stream()
                    .sorted(Map.Entry.comparingByValue())
                    .limit(carts.size() - MAX_SESSIONS)
                    .map(Map.Entry::getKey)
                    .forEach(sid -> {
                        carts.remove(sid);
                        lastAccessAt.remove(sid);
                    });
        }
    }

    private static void validateSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank() || sessionId.length() > 100) {
            throw new IllegalArgumentException("缺少有效的演示会话标识");
        }
    }

    record CartLine(String dishId, String name, String icon, String artColor, BigDecimal price,
                    int quantity, BigDecimal lineTotal) {}
    record CartView(List<CartLine> items, int itemCount, BigDecimal total) {}
}
