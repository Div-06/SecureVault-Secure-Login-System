-- Secure Login System Database Schema
CREATE DATABASE IF NOT EXISTS secure_login CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE secure_login;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_verified TINYINT(1) DEFAULT 0,
  is_locked TINYINT(1) DEFAULT 0,
  failed_attempts INT DEFAULT 0,
  locked_until DATETIME NULL,
  two_factor_enabled TINYINT(1) DEFAULT 0,
  two_factor_secret VARCHAR(255) NULL,
  two_factor_temp_secret VARCHAR(255) NULL,
  reset_token VARCHAR(255) NULL,
  reset_token_expires DATETIME NULL,
  profile_picture VARCHAR(500) NULL,
  last_login DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status ENUM('success', 'failed', 'locked') DEFAULT 'success',
  device_type VARCHAR(50),
  location VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT,
  ip_address VARCHAR(45),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_reset_token ON users(reset_token);
CREATE INDEX idx_login_history_user ON login_history(user_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);

-- Sample admin user (password: Admin@123456)
-- INSERT INTO users (full_name, username, email, password_hash, is_verified) VALUES
-- ('Admin User', 'admin', 'admin@example.com', '$2b$12$...', 1);
