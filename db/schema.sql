-- ShopVoice — schema สำหรับ MySQL 8
-- ใช้ utf8mb4 เพื่อรองรับอีโมจิในชื่อสินค้าและคำค้นภาษาไทย

CREATE DATABASE IF NOT EXISTS shopvoice
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE shopvoice;

CREATE TABLE IF NOT EXISTS products (
  id             VARCHAR(64)   NOT NULL,
  name           VARCHAR(191)  NOT NULL,
  brand          VARCHAR(120)  NOT NULL,
  category       VARCHAR(32)   NOT NULL,
  price          INT UNSIGNED  NOT NULL,
  original_price INT UNSIGNED  NOT NULL DEFAULT 0,
  stock          INT           NOT NULL DEFAULT 0,
  rating         DECIMAL(2,1)  NOT NULL DEFAULT 0.0,
  review_count   INT UNSIGNED  NOT NULL DEFAULT 0,
  released_at    DATE          NOT NULL,
  emoji          VARCHAR(16)   NOT NULL DEFAULT '',
  keywords       JSON          NOT NULL,
  description    TEXT          NOT NULL,
  features       JSON          NOT NULL,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_products_category (category),
  KEY idx_products_price (price),
  KEY idx_products_rating (rating),
  KEY idx_products_released_at (released_at)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
