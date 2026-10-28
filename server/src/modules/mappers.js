/** Row -> API shape mappers. DB is snake_case, the API contract is camelCase. */

const number = (value) => (value === null || value === undefined ? 0 : Number(value));
const nullableNumber = (value) => (value === null || value === undefined ? null : Number(value));
const bool = (value) => Boolean(value);

export const mapUser = (row) =>
  row && {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    avatarUrl: row.avatar_url ?? null,
    isActive: bool(row.is_active),
    createdAt: row.created_at,
  };

export const mapAddress = (row) =>
  row && {
    id: row.id,
    label: row.label,
    contactName: row.contact_name,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    isDefault: bool(row.is_default),
    createdAt: row.created_at,
  };

export const mapCategory = (row) =>
  row && {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    isActive: bool(row.is_active),
    foodCount: row.food_count !== undefined ? number(row.food_count) : undefined,
    createdAt: row.created_at,
  };

export const mapRestaurant = (row) =>
  row && {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    cuisine: row.cuisine,
    address: row.address,
    city: row.city,
    imageUrl: row.image_url,
    coverImageUrl: row.cover_image_url,
    rating: Number(row.rating),
    reviewCount: number(row.review_count),
    deliveryTime: number(row.delivery_time),
    deliveryFee: number(row.delivery_fee),
    minOrder: number(row.min_order),
    priceForTwo: number(row.price_for_two),
    isOpen: bool(row.is_open),
    isFeatured: bool(row.is_featured),
    isActive: bool(row.is_active),
    sortOrder: number(row.sort_order),
    foodCount: row.food_count !== undefined ? number(row.food_count) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

export const mapFood = (row) => {
  if (!row) return null;
  const price = number(row.price);
  const discountPrice = nullableNumber(row.discount_price);
  const effectivePrice = discountPrice !== null && discountPrice < price ? discountPrice : price;
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant_name ?? undefined,
    restaurantSlug: row.restaurant_slug ?? undefined,
    restaurantIsOpen: row.restaurant_is_open !== undefined ? bool(row.restaurant_is_open) : undefined,
    categoryId: row.category_id,
    categoryName: row.category_name ?? undefined,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    price,
    discountPrice,
    effectivePrice,
    discountPercent:
      discountPrice !== null && discountPrice < price
        ? Math.round(((price - discountPrice) / price) * 100)
        : 0,
    foodType: row.food_type,
    calories: nullableNumber(row.calories),
    prepTime: number(row.prep_time),
    stock: number(row.stock),
    isAvailable: bool(row.is_available),
    isFeatured: bool(row.is_featured),
    rating: Number(row.rating),
    reviewCount: number(row.review_count),
    tag: row.tag,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const mapBanner = (row) =>
  row && {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.image_url,
    ctaLabel: row.cta_label,
    ctaLink: row.cta_link,
    accent: row.accent,
    sortOrder: row.sort_order,
    isActive: bool(row.is_active),
    createdAt: row.created_at,
  };

export const mapCoupon = (row) =>
  row && {
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: row.discount_type,
    discountValue: number(row.discount_value),
    minOrderValue: number(row.min_order_value),
    maxDiscount: nullableNumber(row.max_discount),
    usageLimit: nullableNumber(row.usage_limit),
    perUserLimit: number(row.per_user_limit),
    usedCount: number(row.used_count),
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    isActive: bool(row.is_active),
    createdAt: row.created_at,
    usageByUser: row.usage_by_user !== undefined ? number(row.usage_by_user) : undefined,
  };

export const mapReview = (row) =>
  row && {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    isApproved: bool(row.is_approved),
    createdAt: row.created_at,
    orderId: row.order_id,
    foodId: row.food_id,
    foodName: row.food_name ?? undefined,
    foodImageUrl: row.food_image_url ?? undefined,
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant_name ?? undefined,
    userId: row.user_id,
    userName: row.user_name ?? undefined,
    userAvatarUrl: row.user_avatar_url ?? undefined,
  };

export const mapOrderItem = (row) => ({
  id: row.id,
  foodId: row.food_id,
  name: row.name,
  imageUrl: row.image_url,
  unitPrice: number(row.unit_price),
  quantity: number(row.quantity),
  lineTotal: number(row.line_total),
});

export const mapOrder = (row, extras = {}) =>
  row && {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    deliveryAddress: {
      line1: row.delivery_line1,
      line2: row.delivery_line2,
      city: row.delivery_city,
      pincode: row.delivery_pincode,
    },
    notes: row.notes,
    subtotal: number(row.subtotal),
    discount: number(row.discount),
    deliveryFee: number(row.delivery_fee),
    tax: number(row.tax),
    total: number(row.total),
    couponCode: row.coupon_code,
    cancelReason: row.cancel_reason,
    placedAt: row.placed_at,
    deliveredAt: row.delivered_at,
    cancelledAt: row.cancelled_at,
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant_name ?? undefined,
    restaurantImageUrl: row.restaurant_image_url ?? undefined,
    userId: row.user_id,
    customerName: row.customer_name ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    items: extras.items ?? [],
    itemCount: extras.itemCount ?? (extras.items || []).reduce((sum, item) => sum + item.quantity, 0),
    statusHistory: extras.statusHistory ?? [],
    hasReview: extras.hasReview ?? undefined,
  };
