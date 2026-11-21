package com.hiai.demo.checkout;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

final class DemoCatalog {
    static final Store STORE = new Store("朱家大院 · 点餐演示店", "现点现做，演示数据不会产生真实订单");
    static final List<Category> CATEGORIES = List.of(
            new Category("signature", "招牌推荐"),
            new Category("hot", "热菜"),
            new Category("staple", "主食"),
            new Category("drink", "饮品")
    );
    static final List<Dish> DISHES = List.of(
            new Dish("dish-001", "signature", "院子红烧肉", "慢火收汁，软糯入味", new BigDecimal("38.00"), "招牌", "🍖", "#FFF0E8"),
            new Dish("dish-002", "signature", "砂锅鲜鱼头", "鲜香微辣，适合两人分享", new BigDecimal("58.00"), "人气", "🍲", "#FFF4D8"),
            new Dish("dish-003", "hot", "小炒黄牛肉", "大火快炒，香辣下饭", new BigDecimal("42.00"), "辣", "🥩", "#FFE9E7"),
            new Dish("dish-004", "hot", "清炒时蔬", "当日新鲜蔬菜，清爽少油", new BigDecimal("18.00"), "清爽", "🥬", "#EAF7EC"),
            new Dish("dish-005", "staple", "农家炒饭", "鸡蛋、时蔬与米饭粒粒分明", new BigDecimal("16.00"), null, "🍚", "#FFF6DB"),
            new Dish("dish-006", "staple", "手工汤面", "骨汤打底，面条筋道", new BigDecimal("20.00"), null, "🍜", "#F5EDE5"),
            new Dish("dish-007", "drink", "桂花酸梅汤", "酸甜解腻，冰镇更佳", new BigDecimal("9.00"), "冰饮", "🥤", "#F2E7FF"),
            new Dish("dish-008", "drink", "山泉乌龙茶", "清香回甘，无糖饮品", new BigDecimal("8.00"), "无糖", "🍵", "#E7F4ED")
    );
    static final Map<String, Dish> DISH_BY_ID = DISHES.stream()
            .collect(Collectors.toUnmodifiableMap(Dish::id, Function.identity()));

    private DemoCatalog() {}

    record Store(String name, String notice) {}
    record Category(String id, String name) {}
    record Dish(String id, String categoryId, String name, String description, BigDecimal price,
                String tag, String icon, String artColor) {}
}
