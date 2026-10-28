-- Craveo (PHP edition) - full install: schema + demo data
-- Usage: mysql -u root craveo < install.sql

-- Craveo schema (MySQL 8 / MariaDB 10.6+ compatible)
-- Money columns use DECIMAL(10,2). All timestamps are UTC.

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  phone         VARCHAR(20) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('CUSTOMER','MANAGER','ADMIN') NOT NULL DEFAULT 'CUSTOMER',
  avatar_url    VARCHAR(500) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(80) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  image_url   VARCHAR(500) NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_categories_slug (slug),
  KEY idx_categories_active (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS restaurants (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(120) NOT NULL,
  slug             VARCHAR(140) NOT NULL,
  description      VARCHAR(500) NULL,
  cuisine          VARCHAR(80) NOT NULL DEFAULT 'Multi cuisine',
  address          VARCHAR(255) NULL,
  city             VARCHAR(80) NOT NULL DEFAULT 'Chennai',
  image_url        VARCHAR(500) NULL,
  cover_image_url  VARCHAR(500) NULL,
  rating           DECIMAL(2,1) NOT NULL DEFAULT 4.2,
  review_count     INT NOT NULL DEFAULT 0,
  delivery_time    INT NOT NULL DEFAULT 30,
  delivery_fee     DECIMAL(10,2) NOT NULL DEFAULT 30.00,
  min_order        DECIMAL(10,2) NOT NULL DEFAULT 99.00,
  price_for_two    DECIMAL(10,2) NOT NULL DEFAULT 400.00,
  is_open          TINYINT(1) NOT NULL DEFAULT 1,
  is_featured      TINYINT(1) NOT NULL DEFAULT 0,
  is_active        TINYINT(1) NOT NULL DEFAULT 1,
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_restaurants_slug (slug),
  KEY idx_restaurants_listing (is_active, is_open, sort_order),
  KEY idx_restaurants_cuisine (cuisine)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS foods (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  restaurant_id  INT UNSIGNED NOT NULL,
  category_id    INT UNSIGNED NOT NULL,
  name           VARCHAR(120) NOT NULL,
  description    VARCHAR(500) NULL,
  image_url      VARCHAR(500) NULL,
  price          DECIMAL(10,2) NOT NULL,
  discount_price DECIMAL(10,2) NULL,
  food_type      ENUM('VEG','NON_VEG','EGG') NOT NULL DEFAULT 'VEG',
  calories       INT NULL,
  prep_time      INT NOT NULL DEFAULT 20,
  stock          INT NOT NULL DEFAULT 50,
  is_available   TINYINT(1) NOT NULL DEFAULT 1,
  is_featured    TINYINT(1) NOT NULL DEFAULT 0,
  rating         DECIMAL(2,1) NOT NULL DEFAULT 0,
  review_count   INT NOT NULL DEFAULT 0,
  tag            VARCHAR(40) NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_foods_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_foods_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
  KEY idx_foods_listing (is_available, is_featured),
  KEY idx_foods_restaurant (restaurant_id),
  KEY idx_foods_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS addresses (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  label        VARCHAR(40) NOT NULL DEFAULT 'Home',
  contact_name VARCHAR(100) NOT NULL,
  phone        VARCHAR(20) NOT NULL,
  line1        VARCHAR(255) NOT NULL,
  line2        VARCHAR(255) NULL,
  city         VARCHAR(80) NOT NULL,
  state        VARCHAR(80) NULL,
  pincode      VARCHAR(12) NOT NULL,
  is_default   TINYINT(1) NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  KEY idx_addresses_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS banners (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(120) NOT NULL,
  subtitle   VARCHAR(255) NULL,
  image_url  VARCHAR(500) NULL,
  cta_label  VARCHAR(40) NULL,
  cta_link   VARCHAR(255) NULL,
  accent     VARCHAR(20) NOT NULL DEFAULT '#ff5a1f',
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_banners_active (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coupons (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(30) NOT NULL,
  description     VARCHAR(255) NULL,
  discount_type   ENUM('PERCENT','FLAT') NOT NULL DEFAULT 'PERCENT',
  discount_value  DECIMAL(10,2) NOT NULL,
  min_order_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_discount    DECIMAL(10,2) NULL,
  usage_limit     INT NULL,
  per_user_limit  INT NOT NULL DEFAULT 1,
  used_count      INT NOT NULL DEFAULT 0,
  starts_at       DATETIME NULL,
  expires_at      DATETIME NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_coupons_code (code),
  KEY idx_coupons_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number     VARCHAR(24) NOT NULL,
  user_id          INT UNSIGNED NOT NULL,
  restaurant_id    INT UNSIGNED NOT NULL,
  status           ENUM('PENDING','CONFIRMED','PREPARING','OUT_FOR_DELIVERY','DELIVERED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  payment_method   ENUM('COD','UPI','CARD') NOT NULL DEFAULT 'COD',
  payment_status   ENUM('PENDING','PAID','REFUNDED','FAILED') NOT NULL DEFAULT 'PENDING',
  contact_name     VARCHAR(100) NOT NULL,
  contact_phone    VARCHAR(20) NOT NULL,
  delivery_line1   VARCHAR(255) NOT NULL,
  delivery_line2   VARCHAR(255) NULL,
  delivery_city    VARCHAR(80) NOT NULL,
  delivery_pincode VARCHAR(12) NOT NULL,
  notes            VARCHAR(500) NULL,
  subtotal         DECIMAL(10,2) NOT NULL,
  discount         DECIMAL(10,2) NOT NULL DEFAULT 0,
  delivery_fee     DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax              DECIMAL(10,2) NOT NULL DEFAULT 0,
  total            DECIMAL(10,2) NOT NULL,
  coupon_id        INT UNSIGNED NULL,
  coupon_code      VARCHAR(30) NULL,
  cancel_reason    VARCHAR(255) NULL,
  placed_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at     DATETIME NULL,
  cancelled_at     DATETIME NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_orders_number (order_number),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_coupon FOREIGN KEY (coupon_id) REFERENCES coupons (id) ON DELETE SET NULL,
  KEY idx_orders_user (user_id, placed_at),
  KEY idx_orders_status (status),
  KEY idx_orders_placed (placed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id      INT UNSIGNED NOT NULL,
  food_id       INT UNSIGNED NULL,
  name          VARCHAR(120) NOT NULL,
  image_url     VARCHAR(500) NULL,
  unit_price    DECIMAL(10,2) NOT NULL,
  quantity      INT NOT NULL,
  line_total    DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_food FOREIGN KEY (food_id) REFERENCES foods (id) ON DELETE SET NULL,
  KEY idx_order_items_order (order_id),
  KEY idx_order_items_food (food_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_status_history (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id   INT UNSIGNED NOT NULL,
  status     VARCHAR(30) NOT NULL,
  note       VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_status_history_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  KEY idx_status_history_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  coupon_id  INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  order_id   INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_redemption_coupon FOREIGN KEY (coupon_id) REFERENCES coupons (id) ON DELETE CASCADE,
  CONSTRAINT fk_redemption_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_redemption_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  KEY idx_redemption_coupon (coupon_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  food_id       INT UNSIGNED NOT NULL,
  restaurant_id INT UNSIGNED NOT NULL,
  order_id      INT UNSIGNED NOT NULL,
  rating        TINYINT NOT NULL,
  comment       VARCHAR(600) NULL,
  is_approved   TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_food FOREIGN KEY (food_id) REFERENCES foods (id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  UNIQUE KEY uq_reviews_once (order_id, food_id),
  KEY idx_reviews_food (food_id, is_approved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS favourites (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  food_id    INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_favourites_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_favourites_food FOREIGN KEY (food_id) REFERENCES foods (id) ON DELETE CASCADE,
  UNIQUE KEY uq_favourites (user_id, food_id),
  KEY idx_favourites_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  setting_key   VARCHAR(60) NOT NULL PRIMARY KEY,
  setting_value TEXT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------
-- Demo data (6 restaurants, 31 dishes, 5 users, coupons, orders)
-- ---------------------------------------------------------------
-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: 127.0.0.1    Database: craveo
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping data for table `addresses`
--

INSERT INTO `addresses` (`id`, `user_id`, `label`, `contact_name`, `phone`, `line1`, `line2`, `city`, `state`, `pincode`, `is_default`, `created_at`, `updated_at`) VALUES (1,3,'Home','Priya Sharma','+91 98400 33333','18, Lake View Apartments','Besant Nagar','Chennai','Tamil Nadu','600090',1,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(2,4,'Work','Karthik Raja','+91 98400 44444','4th Floor, Tidel Park','Taramani','Chennai','Tamil Nadu','600113',1,'2026-10-28 07:14:55','2026-10-28 07:14:55');

--
-- Dumping data for table `banners`
--

INSERT INTO `banners` (`id`, `title`, `subtitle`, `image_url`, `cta_label`, `cta_link`, `accent`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES (1,'Flat 20% off your first order','Hot food, zero delivery drama. Use CRAVE20 at checkout.','https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=70','Order now','/foods','#ff5a1f',1,1,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(2,'Biryani festival is live','Seeraga samba rice, copper handi dum, delivered steaming hot.','https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=70','Explore biryanis','/category/biryani','#d97706',2,1,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(3,'Midnight dessert run','Cakes, ice creams and cold coffee delivered till 1 AM.','https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=70','See desserts','/category/desserts','#db2777',3,1,'2026-10-28 07:14:55','2026-10-28 07:14:55');

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `name`, `slug`, `description`, `image_url`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES (1,'Biryani','biryani','Slow-cooked, aromatic and worth the wait','https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=70',1,1,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(2,'Pizza','pizza','Wood-fired bases with generous cheese','https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=70',2,1,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(3,'Burgers','burgers','Stacked, saucy and unapologetically messy','https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=70',3,1,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(4,'South Indian','south-indian','Crisp dosas and filter coffee','https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=70',4,1,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(5,'North Indian','north-indian','Rich gravies and tandoori classics','https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=70',5,1,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(6,'Desserts','desserts','Because there is always room','https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=70',6,1,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(7,'Beverages','beverages','Cold brews, shakes and filter coffee','https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=70',7,1,'2026-10-28 07:14:55','2026-10-28 07:14:55');

--
-- Dumping data for table `coupon_redemptions`
--

INSERT INTO `coupon_redemptions` (`id`, `coupon_id`, `user_id`, `order_id`, `created_at`) VALUES (1,1,3,1,'2026-10-28 07:14:56'),(2,2,5,3,'2026-10-28 07:14:56');

--
-- Dumping data for table `coupons`
--

INSERT INTO `coupons` (`id`, `code`, `description`, `discount_type`, `discount_value`, `min_order_value`, `max_discount`, `usage_limit`, `per_user_limit`, `used_count`, `starts_at`, `expires_at`, `is_active`, `created_at`, `updated_at`) VALUES (1,'CRAVE20','20% off up to ₹150 on orders above ₹299','PERCENT',20.00,299.00,150.00,500,2,1,NULL,NULL,1,'2026-10-28 07:14:55','2026-10-28 07:14:56'),(2,'FLAT75','Flat ₹75 off on orders above ₹249','FLAT',75.00,249.00,NULL,300,1,1,NULL,NULL,1,'2026-10-28 07:14:55','2026-10-28 07:14:56'),(3,'WELCOME100','Flat ₹100 off your first big order above ₹499','FLAT',100.00,499.00,NULL,1000,1,0,NULL,NULL,1,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(4,'BIRYANI10','10% off up to ₹80 on biryani orders above ₹249','PERCENT',10.00,249.00,80.00,400,3,0,NULL,NULL,1,'2026-10-28 07:14:55','2026-10-28 07:14:55');

--
-- Dumping data for table `favourites`
--


--
-- Dumping data for table `foods`
--

INSERT INTO `foods` (`id`, `restaurant_id`, `category_id`, `name`, `description`, `image_url`, `price`, `discount_price`, `food_type`, `calories`, `prep_time`, `stock`, `is_available`, `is_featured`, `rating`, `review_count`, `tag`, `created_at`, `updated_at`) VALUES (1,1,1,'Dindigul Chicken Biryani','Dindigul Chicken Biryani from Dindigul Thalappakatti, prepared fresh to order.','https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=70',289.00,259.00,'NON_VEG',720,30,58,1,1,5.0,621,'Bestseller','2026-10-28 07:14:55','2026-10-28 07:14:56'),(2,1,1,'Mutton Biryani','Mutton Biryani from Dindigul Thalappakatti, prepared fresh to order.','https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=70',349.00,NULL,'NON_VEG',840,35,60,1,1,4.7,412,'Chef special','2026-10-28 07:14:55','2026-10-28 07:14:55'),(3,1,1,'Veg Dum Biryani','Veg Dum Biryani from Dindigul Thalappakatti, prepared fresh to order.','https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=900&q=70',219.00,199.00,'VEG',610,25,60,1,0,4.3,190,NULL,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(4,1,1,'Chicken 65','Chicken 65 from Dindigul Thalappakatti, prepared fresh to order.','https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=900&q=70',199.00,NULL,'NON_VEG',480,20,59,1,0,4.5,305,'Spicy','2026-10-28 07:14:55','2026-10-28 07:14:56'),(5,1,1,'Prawn Biryani','Prawn Biryani from Dindigul Thalappakatti, prepared fresh to order.','https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=70',399.00,369.00,'NON_VEG',690,35,60,1,0,4.4,128,NULL,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(6,2,2,'Margherita Pizza','Margherita Pizza from Napoli Pizza Co., prepared fresh to order.','https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=70',249.00,NULL,'VEG',780,20,60,1,1,4.6,410,'Classic','2026-10-28 07:14:55','2026-10-28 07:14:55'),(7,2,2,'Farmhouse Pizza','Farmhouse Pizza from Napoli Pizza Co., prepared fresh to order.','https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=70',379.00,349.00,'VEG',920,25,60,1,1,4.5,288,'Loaded','2026-10-28 07:14:55','2026-10-28 07:14:55'),(8,2,2,'Pepperoni Pizza','Pepperoni Pizza from Napoli Pizza Co., prepared fresh to order.','https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=70',429.00,NULL,'NON_VEG',1010,25,59,1,1,4.8,521,'Bestseller','2026-10-28 07:14:55','2026-10-28 07:14:56'),(9,2,7,'Garlic Breadsticks','Garlic Breadsticks from Napoli Pizza Co., prepared fresh to order.','https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=70',149.00,129.00,'VEG',380,15,59,1,0,4.2,156,NULL,'2026-10-28 07:14:55','2026-10-28 07:14:56'),(10,2,6,'Choco Lava Cake','Choco Lava Cake from Napoli Pizza Co., prepared fresh to order.','https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=70',129.00,NULL,'VEG',420,12,60,1,0,4.6,240,NULL,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(11,3,3,'Classic Chicken Burger','Classic Chicken Burger from Burger Barn, prepared fresh to order.','https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=70',219.00,NULL,'NON_VEG',640,18,60,1,1,4.5,388,'Bestseller','2026-10-28 07:14:55','2026-10-28 07:14:55'),(12,3,3,'Double Cheese Burger','Double Cheese Burger from Burger Barn, prepared fresh to order.','https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=900&q=70',289.00,259.00,'VEG',810,20,58,1,1,4.0,402,'Cheesy','2026-10-28 07:14:55','2026-10-28 07:14:56'),(13,3,3,'Crispy Veg Burger','Crispy Veg Burger from Burger Barn, prepared fresh to order.','https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=70',179.00,NULL,'VEG',520,15,60,1,0,4.1,172,NULL,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(14,3,3,'Peri Peri Fries','Peri Peri Fries from Burger Barn, prepared fresh to order.','https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=70',129.00,109.00,'VEG',340,12,59,1,0,4.4,264,'Spicy','2026-10-28 07:14:55','2026-10-28 07:14:56'),(15,3,3,'Chicken Nuggets (8)','Chicken Nuggets (8) from Burger Barn, prepared fresh to order.','https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=70',199.00,NULL,'NON_VEG',450,15,60,1,0,4.3,190,NULL,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(16,4,4,'Ghee Podi Dosa','Ghee Podi Dosa from Madurai Meenakshi Mess, prepared fresh to order.','https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=70',149.00,NULL,'VEG',420,15,60,1,1,4.7,830,'Bestseller','2026-10-28 07:14:55','2026-10-28 07:14:55'),(17,4,4,'Idli Sambar (4 pcs)','Idli Sambar (4 pcs) from Madurai Meenakshi Mess, prepared fresh to order.','https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=900&q=70',99.00,NULL,'VEG',280,12,60,1,0,4.5,610,NULL,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(18,4,4,'Ven Pongal','Ven Pongal from Madurai Meenakshi Mess, prepared fresh to order.','https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=70',119.00,109.00,'VEG',390,15,60,1,0,4.4,322,NULL,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(19,4,7,'Filter Coffee','Filter Coffee from Madurai Meenakshi Mess, prepared fresh to order.','https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=70',49.00,NULL,'VEG',90,8,60,1,0,4.8,1180,'Must try','2026-10-28 07:14:55','2026-10-28 07:14:55'),(20,4,4,'Curd Rice','Curd Rice from Madurai Meenakshi Mess, prepared fresh to order.','https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=70',129.00,NULL,'VEG',330,10,60,1,0,4.2,210,NULL,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(21,4,4,'Mini Tiffin Platter','Mini Tiffin Platter from Madurai Meenakshi Mess, prepared fresh to order.','https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=900&q=70',199.00,179.00,'VEG',560,20,60,1,1,4.6,455,'Combo','2026-10-28 07:14:55','2026-10-28 07:14:55'),(22,5,5,'Butter Chicken','Butter Chicken from Punjab Grill House, prepared fresh to order.','https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=70',349.00,NULL,'NON_VEG',720,30,59,1,1,5.0,513,'Bestseller','2026-10-28 07:14:55','2026-10-28 07:14:56'),(23,5,5,'Paneer Butter Masala','Paneer Butter Masala from Punjab Grill House, prepared fresh to order.','https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=900&q=70',289.00,269.00,'VEG',610,28,60,1,1,4.5,388,NULL,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(24,5,5,'Dal Makhani','Dal Makhani from Punjab Grill House, prepared fresh to order.','https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=70',229.00,NULL,'VEG',480,25,60,1,0,4.4,265,NULL,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(25,5,5,'Tandoori Roti (2 pcs)','Tandoori Roti (2 pcs) from Punjab Grill House, prepared fresh to order.','https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=70',59.00,NULL,'VEG',180,12,58,1,0,4.1,142,NULL,'2026-10-28 07:14:55','2026-10-28 07:14:56'),(26,5,5,'Chicken Tikka (6 pcs)','Chicken Tikka (6 pcs) from Punjab Grill House, prepared fresh to order.','https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=900&q=70',329.00,299.00,'NON_VEG',520,25,60,1,1,4.6,304,'Charcoal grilled','2026-10-28 07:14:55','2026-10-28 07:14:55'),(27,6,6,'Death by Chocolate','Death by Chocolate from Sweet Cravings, prepared fresh to order.','https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=70',199.00,NULL,'VEG',640,10,58,1,1,4.8,720,'Bestseller','2026-10-28 07:14:55','2026-10-28 07:14:56'),(28,6,6,'Gulab Jamun (2 pcs)','Gulab Jamun (2 pcs) from Sweet Cravings, prepared fresh to order.','https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=70',99.00,NULL,'VEG',380,8,60,1,0,4.5,310,NULL,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(29,6,6,'Vanilla Bean Ice Cream','Vanilla Bean Ice Cream from Sweet Cravings, prepared fresh to order.','https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=900&q=70',89.00,79.00,'VEG',290,5,60,1,0,4.4,205,NULL,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(30,6,6,'Red Velvet','Red Velvet Pastry from Sweet Cravings, prepared fresh to order.','https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=70',149.00,NULL,'VEG',450,8,60,1,1,4.6,260,NULL,'2026-10-28 07:14:55','2026-10-28 07:21:55'),(31,6,7,'Cold Coffee','Cold Coffee from Sweet Cravings, prepared fresh to order.','https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=900&q=70',129.00,119.00,'VEG',210,8,59,1,0,4.3,188,NULL,'2026-10-28 07:14:55','2026-10-28 07:14:56');

--
-- Dumping data for table `order_items`
--

INSERT INTO `order_items` (`id`, `order_id`, `food_id`, `name`, `image_url`, `unit_price`, `quantity`, `line_total`) VALUES (1,1,1,'Dindigul Chicken Biryani','https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=70',259.00,2,518.00),(2,1,4,'Chicken 65','https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=900&q=70',199.00,1,199.00),(3,2,12,'Double Cheese Burger','https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=900&q=70',259.00,2,518.00),(4,2,14,'Peri Peri Fries','https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=70',109.00,1,109.00),(5,3,22,'Butter Chicken','https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=70',349.00,1,349.00),(6,3,25,'Tandoori Roti (2 pcs)','https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=70',59.00,2,118.00),(7,4,8,'Pepperoni Pizza','https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=70',429.00,1,429.00),(8,4,9,'Garlic Breadsticks','https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=70',129.00,1,129.00),(9,5,27,'Death by Chocolate','https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=70',199.00,2,398.00),(10,5,31,'Cold Coffee','https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=900&q=70',119.00,1,119.00);

--
-- Dumping data for table `order_status_history`
--

INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `note`, `created_at`) VALUES (1,1,'PENDING',NULL,'2026-10-23 07:14:55'),(2,1,'CONFIRMED',NULL,'2026-10-23 07:20:55'),(3,1,'PREPARING',NULL,'2026-10-23 07:26:55'),(4,1,'OUT_FOR_DELIVERY',NULL,'2026-10-23 07:32:55'),(5,1,'DELIVERED',NULL,'2026-10-23 07:38:55'),(6,2,'PENDING',NULL,'2026-10-25 07:14:56'),(7,2,'CONFIRMED',NULL,'2026-10-25 07:20:56'),(8,2,'PREPARING',NULL,'2026-10-25 07:26:56'),(9,2,'OUT_FOR_DELIVERY',NULL,'2026-10-25 07:32:56'),(10,2,'DELIVERED',NULL,'2026-10-25 07:38:56'),(11,3,'PENDING',NULL,'2026-10-26 07:14:56'),(12,3,'CONFIRMED',NULL,'2026-10-26 07:20:56'),(13,3,'PREPARING',NULL,'2026-10-26 07:26:56'),(14,3,'OUT_FOR_DELIVERY',NULL,'2026-10-26 07:32:56'),(15,3,'DELIVERED',NULL,'2026-10-26 07:38:56'),(16,4,'PENDING',NULL,'2026-10-28 06:14:56'),(17,4,'CONFIRMED',NULL,'2026-10-28 06:20:56'),(18,4,'PREPARING',NULL,'2026-10-28 06:26:56'),(19,4,'OUT_FOR_DELIVERY',NULL,'2026-10-28 06:32:56'),(20,5,'PENDING',NULL,'2026-10-28 07:14:56');

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `order_number`, `user_id`, `restaurant_id`, `status`, `payment_method`, `payment_status`, `contact_name`, `contact_phone`, `delivery_line1`, `delivery_line2`, `delivery_city`, `delivery_pincode`, `notes`, `subtotal`, `discount`, `delivery_fee`, `tax`, `total`, `coupon_id`, `coupon_code`, `cancel_reason`, `placed_at`, `delivered_at`, `cancelled_at`, `updated_at`) VALUES (1,'CRV-MVRS4NSRNPXI',3,1,'DELIVERED','COD','PAID','Priya Sharma','+91 98400 33333','18, Lake View Apartments',NULL,'Chennai','600090',NULL,717.00,143.40,0.00,28.68,602.28,1,'CRAVE20',NULL,'2026-10-23 07:14:55','2026-10-23 07:46:55',NULL,'2026-10-28 07:14:55'),(2,'CRV-MVRS4NUG3BSI',4,3,'DELIVERED','UPI','PAID','Karthik Raja','+91 98400 44444','4th Floor, Tidel Park',NULL,'Chennai','600113',NULL,627.00,0.00,0.00,31.35,658.35,NULL,NULL,NULL,'2026-10-25 07:14:56','2026-10-25 07:46:56',NULL,'2026-10-28 07:14:56'),(3,'CRV-MVRS4NVB5KHU',5,5,'DELIVERED','COD','PAID','Aisha Fathima','+91 98400 55555','7, Anna Nagar West',NULL,'Chennai','600040',NULL,467.00,75.00,30.00,19.60,441.60,2,'FLAT75',NULL,'2026-10-26 07:14:56','2026-10-26 07:46:56',NULL,'2026-10-28 07:14:56'),(4,'CRV-MVRS4NWAXYOD',3,2,'OUT_FOR_DELIVERY','UPI','PAID','Priya Sharma','+91 98400 33333','18, Lake View Apartments',NULL,'Chennai','600090',NULL,558.00,0.00,0.00,27.90,585.90,NULL,NULL,NULL,'2026-10-28 06:14:56',NULL,NULL,'2026-10-28 07:14:56'),(5,'CRV-MVRS4NWZOJZH',4,6,'PENDING','COD','PENDING','Karthik Raja','+91 98400 44444','4th Floor, Tidel Park',NULL,'Chennai','600113',NULL,517.00,0.00,0.00,25.85,542.85,NULL,NULL,NULL,'2026-10-28 07:14:56',NULL,NULL,'2026-10-28 07:14:56');

--
-- Dumping data for table `restaurants`
--

INSERT INTO `restaurants` (`id`, `name`, `slug`, `description`, `cuisine`, `address`, `city`, `image_url`, `cover_image_url`, `rating`, `review_count`, `delivery_time`, `delivery_fee`, `min_order`, `price_for_two`, `is_open`, `is_featured`, `is_active`, `sort_order`, `created_at`, `updated_at`) VALUES (1,'Dindigul Thalappakatti','dindigul-thalappakatti','The legendary seeraga samba biryani, slow-cooked in copper handis since 1957.','Biryani','12, Kodambakkam High Road','Chennai','https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=70','https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=70',4.6,1842,35,30.00,149.00,500.00,1,1,1,1,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(2,'Napoli Pizza Co.','napoli-pizza-co','Naples-style 48-hour fermented dough, fired at 450°C in a stone oven.','Pizza','7, Khader Nawaz Khan Road','Chennai','https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=70','https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=70',4.5,963,30,40.00,199.00,650.00,1,1,1,2,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(3,'Burger Barn','burger-barn','Smashed patties, brioche buns and hand-cut peri peri fries.','Burgers','23, Besant Nagar Beach Road','Chennai','https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=900&q=70','https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=70',4.3,1204,25,25.00,149.00,450.00,1,1,1,3,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(4,'Madurai Meenakshi Mess','madurai-meenakshi-mess','Ghee podi dosas, steaming idlis and filter coffee served the Madurai way.','South Indian','5, Mylapore Tank Street','Chennai','https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=70','https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=70',4.4,2310,20,20.00,99.00,300.00,1,0,1,4,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(5,'Punjab Grill House','punjab-grill-house','Charcoal tandoor, butter chicken and gravies simmered for hours.','North Indian','88, Anna Nagar 2nd Avenue','Chennai','https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=70','https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=900&q=70',4.2,745,40,45.00,249.00,800.00,1,0,1,5,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(6,'Sweet Cravings','sweet-cravings','Patisserie-grade cakes, ice creams and cold coffee till midnight.','Desserts','31, Nungambakkam High Road','Chennai','https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=70','https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=70',4.7,1580,25,30.00,99.00,350.00,1,1,1,6,'2026-10-28 07:14:55','2026-10-28 07:14:55');

--
-- Dumping data for table `reviews`
--

INSERT INTO `reviews` (`id`, `user_id`, `food_id`, `restaurant_id`, `order_id`, `rating`, `comment`, `is_approved`, `created_at`, `updated_at`) VALUES (1,3,1,1,1,5,'Seeraga samba rice was perfectly cooked and the biryani reached us piping hot. Portion size is generous.',1,'2026-10-28 07:14:56','2026-10-28 07:14:56'),(2,4,12,3,2,4,'Solid smash burger. Would have loved a little more sauce, but the fries made up for it.',1,'2026-10-28 07:14:56','2026-10-28 07:14:56'),(3,5,22,5,3,5,'Rich, creamy and not overly sweet. The rotis were soft even after delivery.',1,'2026-10-28 07:14:56','2026-10-28 07:14:56');

--
-- Dumping data for table `settings`
--

INSERT INTO `settings` (`setting_key`, `setting_value`, `updated_at`) VALUES ('announcement','Free delivery above ₹499 · Use CRAVE20 for 20% off your first order','2026-10-28 07:14:55'),('app_android_url','','2026-10-28 07:14:55'),('app_ios_url','','2026-10-28 07:14:55'),('company_address','42 Anna Salai, Chennai 600002','2026-10-28 07:14:55'),('currency','INR','2026-10-28 07:14:55'),('currency_symbol','₹','2026-10-28 07:14:55'),('delivery_fee','30','2026-10-28 07:14:55'),('delivery_radius_km','8','2026-10-28 07:14:55'),('facebook_url','https://facebook.com/craveo','2026-10-28 07:14:55'),('free_delivery_above','499','2026-10-28 07:14:55'),('instagram_url','https://instagram.com/craveo','2026-10-28 07:14:55'),('min_order_value','99','2026-10-28 07:14:55'),('opening_hours','10:00 AM - 11:00 PM','2026-10-28 07:14:55'),('site_name','Craveo','2026-10-28 07:14:55'),('support_email','hello@craveo.app','2026-10-28 07:14:55'),('support_phone','+91 98400 12345','2026-10-28 07:14:55'),('tagline','Cravings delivered in 30 minutes','2026-10-28 07:14:55'),('tax_percent','5','2026-10-28 07:14:55'),('twitter_url','https://x.com/craveo','2026-10-28 07:14:55'),('youtube_url','','2026-10-28 07:14:55');

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `phone`, `password_hash`, `role`, `avatar_url`, `is_active`, `created_at`, `updated_at`) VALUES (1,'Arjun Menon','admin@craveo.app','+91 98400 11111','$2a$10$75MseTmq.esVEQIapMH3neKpDCn1jrt623bYJfy5mCDQX7bRj0h6y','ADMIN',NULL,1,'2026-10-28 07:14:54','2026-10-28 07:14:54'),(2,'Divya Raghavan','manager@craveo.app','+91 98400 22222','$2a$10$Ws2W86vMDEyAkW1GHnaU7.Ad77wm4tEM/dD.eQ0NuKINlmFQz403O','MANAGER',NULL,1,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(3,'Priya Sharma','priya@example.com','+91 98400 33333','$2a$10$TLvKLIJncKK.VOys0wnr9e9DhsIe0MtXWV/PKDFJkOHcF4fJFJ7cS','CUSTOMER','https://api.dicebear.com/9.x/notionists/svg?seed=Priya&backgroundColor=ffd5dc',1,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(4,'Karthik Raja','karthik@example.com','+91 98400 44444','$2a$10$5ODtIPA/VpXrQ2n1Lm2fZewSlct3GZaGXiy95kADIbjc4Rv8kXwQC','CUSTOMER','https://api.dicebear.com/9.x/notionists/svg?seed=Karthik&backgroundColor=ffd5dc',1,'2026-10-28 07:14:55','2026-10-28 07:14:55'),(5,'Aisha Fathima','aisha@example.com','+91 98400 55555','$2a$10$YLhKudxx/FOJTlHJmi7KKO1AlGJBhExth0B.A/9y67H/GNBzcdF3O','CUSTOMER','https://api.dicebear.com/9.x/notionists/svg?seed=Aisha&backgroundColor=ffd5dc',1,'2026-10-28 07:14:55','2026-10-28 07:14:55');
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-28 13:09:46
