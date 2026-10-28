import bcrypt from 'bcryptjs';
import { execute, query, queryOne, closePool } from '../config/db.js';
import { migrate } from './migrate.js';
import { DEFAULT_SETTINGS } from '../services/settings.js';
import { buildPricing } from '../services/settings.js';
import { orderNumber, round2, slugify, toMoney } from '../utils/helpers.js';

const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=70`;
const avatar = (seed) => `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&backgroundColor=ffd5dc`;

const TABLES = [
  'order_status_history',
  'coupon_redemptions',
  'order_items',
  'orders',
  'reviews',
  'favourites',
  'addresses',
  'foods',
  'categories',
  'restaurants',
  'banners',
  'coupons',
  'settings',
  'users',
];

const USERS = [
  {
    name: 'Arjun Menon',
    email: 'admin@craveo.app',
    password: 'Admin@123',
    phone: '+91 98400 11111',
    role: 'ADMIN',
  },
  {
    name: 'Divya Raghavan',
    email: 'manager@craveo.app',
    password: 'Manager@123',
    phone: '+91 98400 22222',
    role: 'MANAGER',
  },
  {
    name: 'Priya Sharma',
    email: 'priya@example.com',
    password: 'Customer@123',
    phone: '+91 98400 33333',
    role: 'CUSTOMER',
  },
  {
    name: 'Karthik Raja',
    email: 'karthik@example.com',
    password: 'Customer@123',
    phone: '+91 98400 44444',
    role: 'CUSTOMER',
  },
  {
    name: 'Aisha Fathima',
    email: 'aisha@example.com',
    password: 'Customer@123',
    phone: '+91 98400 55555',
    role: 'CUSTOMER',
  },
];

const CATEGORIES = [
  { name: 'Biryani', description: 'Slow-cooked, aromatic and worth the wait', image: '1631452180519-c014fe946bc7', sort: 1 },
  { name: 'Pizza', description: 'Wood-fired bases with generous cheese', image: '1513104890138-7c749659a591', sort: 2 },
  { name: 'Burgers', description: 'Stacked, saucy and unapologetically messy', image: '1568901346375-23c9450c58cd', sort: 3 },
  { name: 'South Indian', description: 'Crisp dosas and filter coffee', image: '1551183053-bf91a1d81141', sort: 4 },
  { name: 'North Indian', description: 'Rich gravies and tandoori classics', image: '1585032226651-759b368d7246', sort: 5 },
  { name: 'Desserts', description: 'Because there is always room', image: '1563805042-7684c019e1cb', sort: 6 },
  { name: 'Beverages', description: 'Cold brews, shakes and filter coffee', image: '1509042239860-f550ce710b93', sort: 7 },
];

const RESTAURANTS = [
  {
    name: 'Dindigul Thalappakatti',
    cuisine: 'Biryani',
    description: 'The legendary seeraga samba biryani, slow-cooked in copper handis since 1957.',
    address: '12, Kodambakkam High Road',
    city: 'Chennai',
    image: '1631452180519-c014fe946bc7',
    cover: '1601050690597-df0568f70950',
    rating: 4.6,
    reviewCount: 1842,
    deliveryTime: 35,
    deliveryFee: 30,
    minOrder: 149,
    priceForTwo: 500,
    isFeatured: 1,
    sort: 1,
  },
  {
    name: 'Napoli Pizza Co.',
    cuisine: 'Pizza',
    description: 'Naples-style 48-hour fermented dough, fired at 450°C in a stone oven.',
    address: '7, Khader Nawaz Khan Road',
    city: 'Chennai',
    image: '1513104890138-7c749659a591',
    cover: '1574071318508-1cdbab80d002',
    rating: 4.5,
    reviewCount: 963,
    deliveryTime: 30,
    deliveryFee: 40,
    minOrder: 199,
    priceForTwo: 650,
    isFeatured: 1,
    sort: 2,
  },
  {
    name: 'Burger Barn',
    cuisine: 'Burgers',
    description: 'Smashed patties, brioche buns and hand-cut peri peri fries.',
    address: '23, Besant Nagar Beach Road',
    city: 'Chennai',
    image: '1571091718767-18b5b1457add',
    cover: '1550547660-d9450f859349',
    rating: 4.3,
    reviewCount: 1204,
    deliveryTime: 25,
    deliveryFee: 25,
    minOrder: 149,
    priceForTwo: 450,
    isFeatured: 1,
    sort: 3,
  },
  {
    name: 'Madurai Meenakshi Mess',
    cuisine: 'South Indian',
    description: 'Ghee podi dosas, steaming idlis and filter coffee served the Madurai way.',
    address: '5, Mylapore Tank Street',
    city: 'Chennai',
    image: '1585937421612-70a008356fbe',
    cover: '1551183053-bf91a1d81141',
    rating: 4.4,
    reviewCount: 2310,
    deliveryTime: 20,
    deliveryFee: 20,
    minOrder: 99,
    priceForTwo: 300,
    isFeatured: 0,
    sort: 4,
  },
  {
    name: 'Punjab Grill House',
    cuisine: 'North Indian',
    description: 'Charcoal tandoor, butter chicken and gravies simmered for hours.',
    address: '88, Anna Nagar 2nd Avenue',
    city: 'Chennai',
    image: '1585032226651-759b368d7246',
    cover: '1599487488170-d11ec9c172f0',
    rating: 4.2,
    reviewCount: 745,
    deliveryTime: 40,
    deliveryFee: 45,
    minOrder: 249,
    priceForTwo: 800,
    isFeatured: 0,
    sort: 5,
  },
  {
    name: 'Sweet Cravings',
    cuisine: 'Desserts',
    description: 'Patisserie-grade cakes, ice creams and cold coffee till midnight.',
    address: '31, Nungambakkam High Road',
    city: 'Chennai',
    image: '1563805042-7684c019e1cb',
    cover: '1578985545062-69928b1d9587',
    rating: 4.7,
    reviewCount: 1580,
    deliveryTime: 25,
    deliveryFee: 30,
    minOrder: 99,
    priceForTwo: 350,
    isFeatured: 1,
    sort: 6,
  },
];

const FOODS = [
  // Dindigul Thalappakatti
  { restaurant: 'Dindigul Thalappakatti', category: 'Biryani', name: 'Dindigul Chicken Biryani', price: 289, discount: 259, type: 'NON_VEG', image: '1631452180519-c014fe946bc7', rating: 4.8, reviewCount: 620, featured: 1, tag: 'Bestseller', calories: 720, prep: 30 },
  { restaurant: 'Dindigul Thalappakatti', category: 'Biryani', name: 'Mutton Biryani', price: 349, discount: null, type: 'NON_VEG', image: '1601050690597-df0568f70950', rating: 4.7, reviewCount: 412, featured: 1, tag: 'Chef special', calories: 840, prep: 35 },
  { restaurant: 'Dindigul Thalappakatti', category: 'Biryani', name: 'Veg Dum Biryani', price: 219, discount: 199, type: 'VEG', image: '1563379926898-05f4575a45d8', rating: 4.3, reviewCount: 190, featured: 0, tag: null, calories: 610, prep: 25 },
  { restaurant: 'Dindigul Thalappakatti', category: 'Biryani', name: 'Chicken 65', price: 199, discount: null, type: 'NON_VEG', image: '1626074353765-517a681e40be', rating: 4.5, reviewCount: 305, featured: 0, tag: 'Spicy', calories: 480, prep: 20 },
  { restaurant: 'Dindigul Thalappakatti', category: 'Biryani', name: 'Prawn Biryani', price: 399, discount: 369, type: 'NON_VEG', image: '1544025162-d76694265947', rating: 4.4, reviewCount: 128, featured: 0, tag: null, calories: 690, prep: 35 },

  // Napoli Pizza Co.
  { restaurant: 'Napoli Pizza Co.', category: 'Pizza', name: 'Margherita Pizza', price: 249, discount: null, type: 'VEG', image: '1513104890138-7c749659a591', rating: 4.6, reviewCount: 410, featured: 1, tag: 'Classic', calories: 780, prep: 20 },
  { restaurant: 'Napoli Pizza Co.', category: 'Pizza', name: 'Farmhouse Pizza', price: 379, discount: 349, type: 'VEG', image: '1574071318508-1cdbab80d002', rating: 4.5, reviewCount: 288, featured: 1, tag: 'Loaded', calories: 920, prep: 25 },
  { restaurant: 'Napoli Pizza Co.', category: 'Pizza', name: 'Pepperoni Pizza', price: 429, discount: null, type: 'NON_VEG', image: '1565299624946-b28f40a0ae38', rating: 4.8, reviewCount: 521, featured: 1, tag: 'Bestseller', calories: 1010, prep: 25 },
  { restaurant: 'Napoli Pizza Co.', category: 'Beverages', name: 'Garlic Breadsticks', price: 149, discount: 129, type: 'VEG', image: '1504674900247-0877df9cc836', rating: 4.2, reviewCount: 156, featured: 0, tag: null, calories: 380, prep: 15 },
  { restaurant: 'Napoli Pizza Co.', category: 'Desserts', name: 'Choco Lava Cake', price: 129, discount: null, type: 'VEG', image: '1551024506-0bccd828d307', rating: 4.6, reviewCount: 240, featured: 0, tag: null, calories: 420, prep: 12 },

  // Burger Barn
  { restaurant: 'Burger Barn', category: 'Burgers', name: 'Classic Chicken Burger', price: 219, discount: null, type: 'NON_VEG', image: '1568901346375-23c9450c58cd', rating: 4.5, reviewCount: 388, featured: 1, tag: 'Bestseller', calories: 640, prep: 18 },
  { restaurant: 'Burger Barn', category: 'Burgers', name: 'Double Cheese Burger', price: 289, discount: 259, type: 'VEG', image: '1571091718767-18b5b1457add', rating: 4.6, reviewCount: 401, featured: 1, tag: 'Cheesy', calories: 810, prep: 20 },
  { restaurant: 'Burger Barn', category: 'Burgers', name: 'Crispy Veg Burger', price: 179, discount: null, type: 'VEG', image: '1550547660-d9450f859349', rating: 4.1, reviewCount: 172, featured: 0, tag: null, calories: 520, prep: 15 },
  { restaurant: 'Burger Barn', category: 'Burgers', name: 'Peri Peri Fries', price: 129, discount: 109, type: 'VEG', image: '1546069901-ba9599a7e63c', rating: 4.4, reviewCount: 264, featured: 0, tag: 'Spicy', calories: 340, prep: 12 },
  { restaurant: 'Burger Barn', category: 'Burgers', name: 'Chicken Nuggets (8)', price: 199, discount: null, type: 'NON_VEG', image: '1512621776951-a57141f2eefd', rating: 4.3, reviewCount: 190, featured: 0, tag: null, calories: 450, prep: 15 },

  // Madurai Meenakshi Mess
  { restaurant: 'Madurai Meenakshi Mess', category: 'South Indian', name: 'Ghee Podi Dosa', price: 149, discount: null, type: 'VEG', image: '1551183053-bf91a1d81141', rating: 4.7, reviewCount: 830, featured: 1, tag: 'Bestseller', calories: 420, prep: 15 },
  { restaurant: 'Madurai Meenakshi Mess', category: 'South Indian', name: 'Idli Sambar (4 pcs)', price: 99, discount: null, type: 'VEG', image: '1630383249896-424e482df921', rating: 4.5, reviewCount: 610, featured: 0, tag: null, calories: 280, prep: 12 },
  { restaurant: 'Madurai Meenakshi Mess', category: 'South Indian', name: 'Ven Pongal', price: 119, discount: 109, type: 'VEG', image: '1585937421612-70a008356fbe', rating: 4.4, reviewCount: 322, featured: 0, tag: null, calories: 390, prep: 15 },
  { restaurant: 'Madurai Meenakshi Mess', category: 'Beverages', name: 'Filter Coffee', price: 49, discount: null, type: 'VEG', image: '1509042239860-f550ce710b93', rating: 4.8, reviewCount: 1180, featured: 0, tag: 'Must try', calories: 90, prep: 8 },
  { restaurant: 'Madurai Meenakshi Mess', category: 'South Indian', name: 'Curd Rice', price: 129, discount: null, type: 'VEG', image: '1546069901-ba9599a7e63c', rating: 4.2, reviewCount: 210, featured: 0, tag: null, calories: 330, prep: 10 },
  { restaurant: 'Madurai Meenakshi Mess', category: 'South Indian', name: 'Mini Tiffin Platter', price: 199, discount: 179, type: 'VEG', image: '1599487488170-d11ec9c172f0', rating: 4.6, reviewCount: 455, featured: 1, tag: 'Combo', calories: 560, prep: 20 },

  // Punjab Grill House
  { restaurant: 'Punjab Grill House', category: 'North Indian', name: 'Butter Chicken', price: 349, discount: null, type: 'NON_VEG', image: '1585032226651-759b368d7246', rating: 4.7, reviewCount: 512, featured: 1, tag: 'Bestseller', calories: 720, prep: 30 },
  { restaurant: 'Punjab Grill House', category: 'North Indian', name: 'Paneer Butter Masala', price: 289, discount: 269, type: 'VEG', image: '1606491956689-2ea866880c84', rating: 4.5, reviewCount: 388, featured: 1, tag: null, calories: 610, prep: 28 },
  { restaurant: 'Punjab Grill House', category: 'North Indian', name: 'Dal Makhani', price: 229, discount: null, type: 'VEG', image: '1544025162-d76694265947', rating: 4.4, reviewCount: 265, featured: 0, tag: null, calories: 480, prep: 25 },
  { restaurant: 'Punjab Grill House', category: 'North Indian', name: 'Tandoori Roti (2 pcs)', price: 59, discount: null, type: 'VEG', image: '1504674900247-0877df9cc836', rating: 4.1, reviewCount: 142, featured: 0, tag: null, calories: 180, prep: 12 },
  { restaurant: 'Punjab Grill House', category: 'North Indian', name: 'Chicken Tikka (6 pcs)', price: 329, discount: 299, type: 'NON_VEG', image: '1599487488170-d11ec9c172f0', rating: 4.6, reviewCount: 304, featured: 1, tag: 'Charcoal grilled', calories: 520, prep: 25 },

  // Sweet Cravings
  { restaurant: 'Sweet Cravings', category: 'Desserts', name: 'Death by Chocolate', price: 199, discount: null, type: 'VEG', image: '1578985545062-69928b1d9587', rating: 4.8, reviewCount: 720, featured: 1, tag: 'Bestseller', calories: 640, prep: 10 },
  { restaurant: 'Sweet Cravings', category: 'Desserts', name: 'Gulab Jamun (2 pcs)', price: 99, discount: null, type: 'VEG', image: '1551024506-0bccd828d307', rating: 4.5, reviewCount: 310, featured: 0, tag: null, calories: 380, prep: 8 },
  { restaurant: 'Sweet Cravings', category: 'Desserts', name: 'Vanilla Bean Ice Cream', price: 89, discount: 79, type: 'VEG', image: '1559056199-641a0ac8b55e', rating: 4.4, reviewCount: 205, featured: 0, tag: null, calories: 290, prep: 5 },
  { restaurant: 'Sweet Cravings', category: 'Desserts', name: 'Red Velvet Pastry', price: 149, discount: null, type: 'VEG', image: '1488477181946-6428a0291777', rating: 4.6, reviewCount: 260, featured: 1, tag: null, calories: 450, prep: 8 },
  { restaurant: 'Sweet Cravings', category: 'Beverages', name: 'Cold Coffee', price: 129, discount: 119, type: 'VEG', image: '1497034825429-c343d7c6a68f', rating: 4.3, reviewCount: 188, featured: 0, tag: null, calories: 210, prep: 8 },
];

const BANNERS = [
  {
    title: 'Flat 20% off your first order',
    subtitle: 'Hot food, zero delivery drama. Use CRAVE20 at checkout.',
    image: '1504674900247-0877df9cc836',
    ctaLabel: 'Order now',
    ctaLink: '/foods',
    accent: '#ff5a1f',
    sort: 1,
  },
  {
    title: 'Biryani festival is live',
    subtitle: 'Seeraga samba rice, copper handi dum, delivered steaming hot.',
    image: '1631452180519-c014fe946bc7',
    ctaLabel: 'Explore biryanis',
    ctaLink: '/category/biryani',
    accent: '#d97706',
    sort: 2,
  },
  {
    title: 'Midnight dessert run',
    subtitle: 'Cakes, ice creams and cold coffee delivered till 1 AM.',
    image: '1563805042-7684c019e1cb',
    ctaLabel: 'See desserts',
    ctaLink: '/category/desserts',
    accent: '#db2777',
    sort: 3,
  },
];

const COUPONS = [
  { code: 'CRAVE20', description: '20% off up to ₹150 on orders above ₹299', type: 'PERCENT', value: 20, min: 299, max: 150, limit: 500, perUser: 2 },
  { code: 'FLAT75', description: 'Flat ₹75 off on orders above ₹249', type: 'FLAT', value: 75, min: 249, max: null, limit: 300, perUser: 1 },
  { code: 'WELCOME100', description: 'Flat ₹100 off your first big order above ₹499', type: 'FLAT', value: 100, min: 499, max: null, limit: 1000, perUser: 1 },
  { code: 'BIRYANI10', description: '10% off up to ₹80 on biryani orders above ₹249', type: 'PERCENT', value: 10, min: 249, max: 80, limit: 400, perUser: 3 },
];

const SETTINGS_OVERRIDES = {
  site_name: 'Craveo',
  tagline: 'Cravings delivered in 30 minutes',
  announcement: 'Free delivery above ₹499 · Use CRAVE20 for 20% off your first order',
  support_phone: '+91 98400 12345',
  support_email: 'hello@craveo.app',
  company_address: '42 Anna Salai, Chennai 600002',
  instagram_url: 'https://instagram.com/craveo',
  facebook_url: 'https://facebook.com/craveo',
};

const truncateAll = async () => {
  await execute('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of TABLES) {
    await execute(`TRUNCATE TABLE ${table}`);
  }
  await execute('SET FOREIGN_KEY_CHECKS = 1');
};

const insertUser = async (user) => {
  const hash = await bcrypt.hash(user.password, 10);
  const result = await execute(
    'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [user.name, user.email, user.phone, hash, user.role],
  );
  return result.insertId;
};

const createOrder = async ({
  userId,
  restaurantId,
  lines,
  status,
  daysAgo = 0,
  hoursAgo = 0,
  paymentMethod = 'COD',
  coupon = null,
  address,
  restaurant,
}) => {
  const subtotal = round2(lines.reduce((sum, line) => sum + line.price * line.quantity, 0));
  const discount = coupon
    ? Math.min(
        coupon.type === 'PERCENT' ? round2((subtotal * coupon.value) / 100) : toMoney(coupon.value),
        coupon.max ? toMoney(coupon.max) : Infinity,
        subtotal,
      )
    : 0;

  const settings = { ...DEFAULT_SETTINGS, ...SETTINGS_OVERRIDES };
  const pricing = buildPricing({ subtotal, restaurant, settings, discount });
  const placedAt = new Date(Date.now() - (daysAgo * 24 + hoursAgo) * 3_600_000);

  const orderInsert = await execute(
    `INSERT INTO orders (order_number, user_id, restaurant_id, status, payment_method, payment_status,
       contact_name, contact_phone, delivery_line1, delivery_city, delivery_pincode, notes,
       subtotal, discount, delivery_fee, tax, total, coupon_id, coupon_code, placed_at,
       delivered_at, cancelled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderNumber(),
      userId,
      restaurantId,
      status,
      paymentMethod,
      status === 'DELIVERED' ? 'PAID' : paymentMethod === 'COD' ? 'PENDING' : 'PAID',
      address.contactName,
      address.phone,
      address.line1,
      address.city,
      address.pincode,
      null,
      pricing.subtotal,
      pricing.discount,
      pricing.deliveryFee,
      pricing.tax,
      pricing.total,
      coupon?.id ?? null,
      coupon?.code ?? null,
      placedAt,
      status === 'DELIVERED' ? new Date(placedAt.getTime() + 32 * 60_000) : null,
      null,
    ],
  );

  const orderId = orderInsert.insertId;
  for (const line of lines) {
    await execute(
      `INSERT INTO order_items (order_id, food_id, name, image_url, unit_price, quantity, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orderId, line.foodId, line.name, line.imageUrl, line.price, line.quantity, round2(line.price * line.quantity)],
    );
    await execute('UPDATE foods SET stock = GREATEST(stock - ?, 0) WHERE id = ?', [line.quantity, line.foodId]);
  }

  const history = {
    PENDING: ['PENDING'],
    CONFIRMED: ['PENDING', 'CONFIRMED'],
    PREPARING: ['PENDING', 'CONFIRMED', 'PREPARING'],
    OUT_FOR_DELIVERY: ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'],
    DELIVERED: ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'],
    CANCELLED: ['PENDING', 'CANCELLED'],
  }[status] || ['PENDING'];

  for (const [index, entry] of history.entries()) {
    await execute(
      'INSERT INTO order_status_history (order_id, status, note, created_at) VALUES (?, ?, ?, ?)',
      [orderId, entry, null, new Date(placedAt.getTime() + index * 6 * 60_000)],
    );
  }

  if (coupon) {
    await execute('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [coupon.id]);
    await execute('INSERT INTO coupon_redemptions (coupon_id, user_id, order_id) VALUES (?, ?, ?)', [
      coupon.id,
      userId,
      orderId,
    ]);
  }

  return { orderId, pricing };
};

export const seed = async () => {
  await migrate({ quiet: true });
  await truncateAll();

  const userIds = {};
  for (const user of USERS) {
    userIds[user.email] = await insertUser(user);
  }

  for (const [email, seedName] of [
    ['priya@example.com', 'Priya'],
    ['karthik@example.com', 'Karthik'],
    ['aisha@example.com', 'Aisha'],
  ]) {
    await execute('UPDATE users SET avatar_url = ? WHERE id = ?', [avatar(seedName), userIds[email]]);
  }

  await execute(
    `INSERT INTO addresses (user_id, label, contact_name, phone, line1, line2, city, state, pincode, is_default)
     VALUES (?, 'Home', 'Priya Sharma', '+91 98400 33333', '18, Lake View Apartments', 'Besant Nagar', 'Chennai', 'Tamil Nadu', '600090', 1),
            (?, 'Work', 'Karthik Raja', '+91 98400 44444', '4th Floor, Tidel Park', 'Taramani', 'Chennai', 'Tamil Nadu', '600113', 1)`,
    [userIds['priya@example.com'], userIds['karthik@example.com']],
  );

  const categoryIds = {};
  for (const category of CATEGORIES) {
    const result = await execute(
      `INSERT INTO categories (name, slug, description, image_url, sort_order, is_active) VALUES (?, ?, ?, ?, ?, 1)`,
      [category.name, slugify(category.name), category.description, img(category.image), category.sort],
    );
    categoryIds[category.name] = result.insertId;
  }

  const restaurantIds = {};
  const restaurantRows = {};
  for (const restaurant of RESTAURANTS) {
    const result = await execute(
      `INSERT INTO restaurants (name, slug, description, cuisine, address, city, image_url, cover_image_url,
         rating, review_count, delivery_time, delivery_fee, min_order, price_for_two, is_open, is_featured, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1, ?)`,
      [
        restaurant.name,
        slugify(restaurant.name),
        restaurant.description,
        restaurant.cuisine,
        restaurant.address,
        restaurant.city,
        img(restaurant.image),
        img(restaurant.cover),
        restaurant.rating,
        restaurant.reviewCount,
        restaurant.deliveryTime,
        restaurant.deliveryFee,
        restaurant.minOrder,
        restaurant.priceForTwo,
        restaurant.isFeatured,
        restaurant.sort,
      ],
    );
    restaurantIds[restaurant.name] = result.insertId;
    restaurantRows[restaurant.name] = restaurant;
  }

  const foodIds = {};
  const foodRows = {};
  for (const food of FOODS) {
    const result = await execute(
      `INSERT INTO foods (restaurant_id, category_id, name, description, image_url, price, discount_price, food_type,
         calories, prep_time, stock, is_available, is_featured, rating, review_count, tag)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [
        restaurantIds[food.restaurant],
        categoryIds[food.category],
        food.name,
        `${food.name} from ${food.restaurant}, prepared fresh to order.`,
        img(food.image),
        food.price,
        food.discount,
        food.type,
        food.calories,
        food.prep,
        60,
        food.featured,
        food.rating,
        food.reviewCount,
        food.tag,
      ],
    );
    foodIds[food.name] = result.insertId;
    foodRows[food.name] = { ...food, foodId: result.insertId, imageUrl: img(food.image) };
  }

  for (const banner of BANNERS) {
    await execute(
      `INSERT INTO banners (title, subtitle, image_url, cta_label, cta_link, accent, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [banner.title, banner.subtitle, img(banner.image), banner.ctaLabel, banner.ctaLink, banner.accent, banner.sort],
    );
  }

  const couponIds = {};
  for (const coupon of COUPONS) {
    const result = await execute(
      `INSERT INTO coupons (code, description, discount_type, discount_value, min_order_value, max_discount,
         usage_limit, per_user_limit, used_count, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      [coupon.code, coupon.description, coupon.type, coupon.value, coupon.min, coupon.max, coupon.limit, coupon.perUser],
    );
    couponIds[coupon.code] = { id: result.insertId, ...coupon, code: coupon.code };
  }

  const settings = { ...DEFAULT_SETTINGS, ...SETTINGS_OVERRIDES };
  for (const [key, value] of Object.entries(settings)) {
    await execute('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)', [key, value]);
  }

  const pick = (name, quantity) => ({
    foodId: foodIds[name],
    name,
    imageUrl: img(foodRows[name].image),
    price: foodRows[name].discount ?? foodRows[name].price,
    quantity,
  });

  const demoOrders = [
    {
      userId: userIds['priya@example.com'],
      restaurant: 'Dindigul Thalappakatti',
      lines: [pick('Dindigul Chicken Biryani', 2), pick('Chicken 65', 1)],
      status: 'DELIVERED',
      daysAgo: 5,
      coupon: couponIds.CRAVE20,
    },
    {
      userId: userIds['karthik@example.com'],
      restaurant: 'Burger Barn',
      lines: [pick('Double Cheese Burger', 2), pick('Peri Peri Fries', 1)],
      status: 'DELIVERED',
      daysAgo: 3,
      paymentMethod: 'UPI',
    },
    {
      userId: userIds['aisha@example.com'],
      restaurant: 'Punjab Grill House',
      lines: [pick('Butter Chicken', 1), pick('Tandoori Roti (2 pcs)', 2)],
      status: 'DELIVERED',
      daysAgo: 2,
      coupon: couponIds.FLAT75,
    },
    {
      userId: userIds['priya@example.com'],
      restaurant: 'Napoli Pizza Co.',
      lines: [pick('Pepperoni Pizza', 1), pick('Garlic Breadsticks', 1)],
      status: 'OUT_FOR_DELIVERY',
      daysAgo: 0,
      hoursAgo: 1,
      paymentMethod: 'UPI',
    },
    {
      userId: userIds['karthik@example.com'],
      restaurant: 'Sweet Cravings',
      lines: [pick('Death by Chocolate', 2), pick('Cold Coffee', 1)],
      status: 'PENDING',
      daysAgo: 0,
      hoursAgo: 0,
      paymentMethod: 'COD',
    },
  ];

  const addresses = {
    [userIds['priya@example.com']]: {
      contactName: 'Priya Sharma',
      phone: '+91 98400 33333',
      line1: '18, Lake View Apartments',
      city: 'Chennai',
      pincode: '600090',
    },
    [userIds['karthik@example.com']]: {
      contactName: 'Karthik Raja',
      phone: '+91 98400 44444',
      line1: '4th Floor, Tidel Park',
      city: 'Chennai',
      pincode: '600113',
    },
    [userIds['aisha@example.com']]: {
      contactName: 'Aisha Fathima',
      phone: '+91 98400 55555',
      line1: '7, Anna Nagar West',
      city: 'Chennai',
      pincode: '600040',
    },
  };

  for (const order of demoOrders) {
    await createOrder({
      userId: order.userId,
      restaurantId: restaurantIds[order.restaurant],
      lines: order.lines,
      status: order.status,
      daysAgo: order.daysAgo,
      hoursAgo: order.hoursAgo ?? 0,
      paymentMethod: order.paymentMethod ?? 'COD',
      coupon: order.coupon ?? null,
      address: addresses[order.userId],
      restaurant: restaurantRows[order.restaurant],
    });
  }

  const reviews = [
    {
      email: 'priya@example.com',
      food: 'Dindigul Chicken Biryani',
      orderId: null,
      rating: 5,
      comment: 'Seeraga samba rice was perfectly cooked and the biryani reached us piping hot. Portion size is generous.',
    },
    {
      email: 'karthik@example.com',
      food: 'Double Cheese Burger',
      orderId: null,
      rating: 4,
      comment: 'Solid smash burger. Would have loved a little more sauce, but the fries made up for it.',
    },
    {
      email: 'aisha@example.com',
      food: 'Butter Chicken',
      orderId: null,
      rating: 5,
      comment: 'Rich, creamy and not overly sweet. The rotis were soft even after delivery.',
    },
  ];

  const deliveredOrders = await query(
    `SELECT o.id, o.user_id FROM orders o WHERE o.status = 'DELIVERED' ORDER BY o.id ASC`,
  );

  for (const review of reviews) {
    const food = foodRows[review.food];
    const restaurant = food.restaurant;
    const order = deliveredOrders.find((row) => row.user_id === userIds[review.email]);
    if (!order) continue;
    await execute(
      `INSERT INTO reviews (user_id, food_id, restaurant_id, order_id, rating, comment, is_approved)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        userIds[review.email],
        food.foodId,
        restaurantIds[restaurant],
        order.id,
        review.rating,
        review.comment,
      ],
    );
  }

  // Recalculate aggregate ratings from the reviews we just inserted.
  await execute(
    `UPDATE foods f
     SET rating = COALESCE((SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.food_id = f.id AND r.is_approved = 1), f.rating),
         review_count = review_count + (SELECT COUNT(*) FROM reviews r WHERE r.food_id = f.id)`,
  );

  const counts = await queryOne(
    `SELECT (SELECT COUNT(*) FROM restaurants) AS restaurants,
            (SELECT COUNT(*) FROM foods) AS foods,
            (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM orders) AS orders,
            (SELECT COUNT(*) FROM coupons) AS coupons`,
  );

  console.log(`[seed] restaurants=${counts.restaurants} foods=${counts.foods} users=${counts.users} orders=${counts.orders} coupons=${counts.coupons}`);
  console.log('[seed] admin login   : admin@craveo.app / Admin@123');
  console.log('[seed] manager login : manager@craveo.app / Manager@123');
  console.log('[seed] customer login: priya@example.com / Customer@123');
};

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seed()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('[seed] failed:', error);
      await closePool().catch(() => {});
      process.exit(1);
    });
}
