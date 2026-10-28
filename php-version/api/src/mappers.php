<?php

declare(strict_types=1);

/** Row -> API shape mappers. DB is snake_case, the API contract is camelCase. */

function has_key(array $row, string $key): bool
{
    return array_key_exists($key, $row);
}

function map_user(?array $row): ?array
{
    if ($row === null) {
        return null;
    }

    return [
        'id' => as_int($row['id']),
        'name' => $row['name'],
        'email' => $row['email'],
        'phone' => $row['phone'],
        'role' => $row['role'],
        'avatarUrl' => $row['avatar_url'] ?? null,
        'isActive' => as_bool($row['is_active']),
        'createdAt' => iso_datetime($row['created_at'] ?? null),
    ];
}

function map_address(?array $row): ?array
{
    if ($row === null) {
        return null;
    }

    return [
        'id' => as_int($row['id']),
        'label' => $row['label'],
        'contactName' => $row['contact_name'],
        'phone' => $row['phone'],
        'line1' => $row['line1'],
        'line2' => $row['line2'],
        'city' => $row['city'],
        'state' => $row['state'],
        'pincode' => $row['pincode'],
        'isDefault' => as_bool($row['is_default']),
        'createdAt' => iso_datetime($row['created_at'] ?? null),
    ];
}

function map_category(?array $row): ?array
{
    if ($row === null) {
        return null;
    }

    $mapped = [
        'id' => as_int($row['id']),
        'name' => $row['name'],
        'slug' => $row['slug'],
        'description' => $row['description'],
        'imageUrl' => $row['image_url'],
        'sortOrder' => as_int($row['sort_order'] ?? 0),
        'isActive' => as_bool($row['is_active']),
    ];

    if (has_key($row, 'food_count')) {
        $mapped['foodCount'] = as_int($row['food_count']);
    }

    $mapped['createdAt'] = iso_datetime($row['created_at'] ?? null);

    return $mapped;
}

function map_restaurant(?array $row): ?array
{
    if ($row === null) {
        return null;
    }

    $mapped = [
        'id' => as_int($row['id']),
        'name' => $row['name'],
        'slug' => $row['slug'],
        'description' => $row['description'] ?? null,
        'cuisine' => $row['cuisine'] ?? null,
        'address' => $row['address'] ?? null,
        'city' => $row['city'] ?? null,
        'imageUrl' => $row['image_url'] ?? null,
        'coverImageUrl' => $row['cover_image_url'] ?? null,
        'rating' => (float) ($row['rating'] ?? 0),
        'reviewCount' => as_int($row['review_count'] ?? 0),
        'deliveryTime' => as_int($row['delivery_time'] ?? 0),
        'deliveryFee' => (float) ($row['delivery_fee'] ?? 0),
        'minOrder' => (float) ($row['min_order'] ?? 0),
        'priceForTwo' => (float) ($row['price_for_two'] ?? 0),
        'isOpen' => as_bool($row['is_open']),
        'isFeatured' => as_bool($row['is_featured']),
        'isActive' => as_bool($row['is_active']),
        'sortOrder' => as_int($row['sort_order'] ?? 0),
    ];

    if (has_key($row, 'food_count')) {
        $mapped['foodCount'] = as_int($row['food_count']);
    }

    $mapped['createdAt'] = iso_datetime($row['created_at'] ?? null);
    $mapped['updatedAt'] = iso_datetime($row['updated_at'] ?? null);

    return $mapped;
}

function map_food(?array $row): ?array
{
    if ($row === null) {
        return null;
    }

    $price = (float) $row['price'];
    $discountPrice = nullable_float($row['discount_price'] ?? null);
    $effectivePrice = ($discountPrice !== null && $discountPrice < $price) ? $discountPrice : $price;

    $mapped = [
        'id' => as_int($row['id']),
        'restaurantId' => as_int($row['restaurant_id']),
    ];

    if (has_key($row, 'restaurant_name')) {
        $mapped['restaurantName'] = $row['restaurant_name'];
    }
    if (has_key($row, 'restaurant_slug')) {
        $mapped['restaurantSlug'] = $row['restaurant_slug'];
    }
    if (has_key($row, 'restaurant_is_open')) {
        $mapped['restaurantIsOpen'] = as_bool($row['restaurant_is_open']);
    }

    $mapped['categoryId'] = as_int($row['category_id']);

    if (has_key($row, 'category_name')) {
        $mapped['categoryName'] = $row['category_name'];
    }

    $mapped['name'] = $row['name'];
    $mapped['description'] = $row['description'];
    $mapped['imageUrl'] = $row['image_url'];
    $mapped['price'] = $price;
    $mapped['discountPrice'] = $discountPrice;
    $mapped['effectivePrice'] = $effectivePrice;
    $mapped['discountPercent'] = ($discountPrice !== null && $discountPrice < $price)
        ? (int) round((($price - $discountPrice) / $price) * 100)
        : 0;
    $mapped['foodType'] = $row['food_type'];
    $mapped['calories'] = array_key_exists('calories', $row) && $row['calories'] !== null
        ? as_int($row['calories'])
        : null;
    $mapped['prepTime'] = as_int($row['prep_time'] ?? 0);
    $mapped['stock'] = as_int($row['stock'] ?? 0);
    $mapped['isAvailable'] = as_bool($row['is_available']);
    $mapped['isFeatured'] = as_bool($row['is_featured']);
    $mapped['rating'] = (float) $row['rating'];
    $mapped['reviewCount'] = as_int($row['review_count'] ?? 0);
    $mapped['tag'] = $row['tag'] ?? null;
    $mapped['createdAt'] = iso_datetime($row['created_at'] ?? null);
    $mapped['updatedAt'] = iso_datetime($row['updated_at'] ?? null);

    return $mapped;
}

function map_banner(?array $row): ?array
{
    if ($row === null) {
        return null;
    }

    return [
        'id' => as_int($row['id']),
        'title' => $row['title'],
        'subtitle' => $row['subtitle'],
        'imageUrl' => $row['image_url'],
        'ctaLabel' => $row['cta_label'],
        'ctaLink' => $row['cta_link'],
        'accent' => $row['accent'],
        'sortOrder' => as_int($row['sort_order'] ?? 0),
        'isActive' => as_bool($row['is_active']),
        'createdAt' => iso_datetime($row['created_at'] ?? null),
    ];
}

function map_coupon(?array $row): ?array
{
    if ($row === null) {
        return null;
    }

    $mapped = [
        'id' => as_int($row['id']),
        'code' => $row['code'],
        'description' => $row['description'],
        'discountType' => $row['discount_type'],
        'discountValue' => (float) $row['discount_value'],
        'minOrderValue' => (float) $row['min_order_value'],
        'maxDiscount' => nullable_float($row['max_discount'] ?? null),
        'usageLimit' => array_key_exists('usage_limit', $row) && $row['usage_limit'] !== null
            ? as_int($row['usage_limit'])
            : null,
        'perUserLimit' => as_int($row['per_user_limit'] ?? 0),
        'usedCount' => as_int($row['used_count'] ?? 0),
        'startsAt' => iso_datetime($row['starts_at'] ?? null),
        'expiresAt' => iso_datetime($row['expires_at'] ?? null),
        'isActive' => as_bool($row['is_active']),
        'createdAt' => iso_datetime($row['created_at'] ?? null),
    ];

    if (has_key($row, 'usage_by_user')) {
        $mapped['usageByUser'] = as_int($row['usage_by_user']);
    }

    return $mapped;
}

function map_review(?array $row): ?array
{
    if ($row === null) {
        return null;
    }

    $mapped = [
        'id' => as_int($row['id']),
        'rating' => as_int($row['rating']),
        'comment' => $row['comment'],
        'isApproved' => as_bool($row['is_approved']),
        'createdAt' => iso_datetime($row['created_at'] ?? null),
        'orderId' => as_int($row['order_id']),
        'foodId' => as_int($row['food_id']),
    ];

    if (has_key($row, 'food_name')) {
        $mapped['foodName'] = $row['food_name'];
    }
    if (has_key($row, 'food_image_url')) {
        $mapped['foodImageUrl'] = $row['food_image_url'];
    }

    $mapped['restaurantId'] = as_int($row['restaurant_id']);

    if (has_key($row, 'restaurant_name')) {
        $mapped['restaurantName'] = $row['restaurant_name'];
    }

    $mapped['userId'] = as_int($row['user_id']);

    if (has_key($row, 'user_name')) {
        $mapped['userName'] = $row['user_name'];
    }
    if (has_key($row, 'user_avatar_url')) {
        $mapped['userAvatarUrl'] = $row['user_avatar_url'];
    }

    return $mapped;
}

function map_order_item(array $row): array
{
    return [
        'id' => as_int($row['id']),
        'foodId' => $row['food_id'] === null ? null : as_int($row['food_id']),
        'name' => $row['name'],
        'imageUrl' => $row['image_url'],
        'unitPrice' => (float) $row['unit_price'],
        'quantity' => as_int($row['quantity']),
        'lineTotal' => (float) $row['line_total'],
    ];
}

function map_order(?array $row, array $extras = []): ?array
{
    if ($row === null) {
        return null;
    }

    $items = $extras['items'] ?? [];

    $mapped = [
        'id' => as_int($row['id']),
        'orderNumber' => $row['order_number'],
        'status' => $row['status'],
        'paymentMethod' => $row['payment_method'],
        'paymentStatus' => $row['payment_status'],
        'contactName' => $row['contact_name'],
        'contactPhone' => $row['contact_phone'],
        'deliveryAddress' => [
            'line1' => $row['delivery_line1'],
            'line2' => $row['delivery_line2'],
            'city' => $row['delivery_city'],
            'pincode' => $row['delivery_pincode'],
        ],
        'notes' => $row['notes'],
        'subtotal' => (float) $row['subtotal'],
        'discount' => (float) $row['discount'],
        'deliveryFee' => (float) $row['delivery_fee'],
        'tax' => (float) $row['tax'],
        'total' => (float) $row['total'],
        'couponCode' => $row['coupon_code'],
        'cancelReason' => $row['cancel_reason'],
        'placedAt' => iso_datetime($row['placed_at'] ?? null),
        'deliveredAt' => iso_datetime($row['delivered_at'] ?? null),
        'cancelledAt' => iso_datetime($row['cancelled_at'] ?? null),
        'restaurantId' => as_int($row['restaurant_id']),
    ];

    if (has_key($row, 'restaurant_name')) {
        $mapped['restaurantName'] = $row['restaurant_name'];
    }
    if (has_key($row, 'restaurant_image_url')) {
        $mapped['restaurantImageUrl'] = $row['restaurant_image_url'];
    }

    $mapped['userId'] = as_int($row['user_id']);

    if (has_key($row, 'customer_name')) {
        $mapped['customerName'] = $row['customer_name'];
    }
    if (has_key($row, 'customer_email')) {
        $mapped['customerEmail'] = $row['customer_email'];
    }

    $mapped['items'] = $items;
    $mapped['itemCount'] = array_reduce(
        $items,
        static fn (int $carry, array $item): int => $carry + (int) $item['quantity'],
        0
    );

    if (array_key_exists('statusHistory', $extras)) {
        $mapped['statusHistory'] = $extras['statusHistory'];
    } else {
        $mapped['statusHistory'] = [];
    }

    if (array_key_exists('hasReview', $extras)) {
        $mapped['hasReview'] = $extras['hasReview'];
    }

    return $mapped;
}
