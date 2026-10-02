-- migrate:up
-- Minimal schema for ReadyNow push notification tokens
-- Only stores essential data: device ID, push token, token hash, and creation timestamp
CREATE TABLE IF NOT EXISTS notification_devices (
  device_id VARCHAR(64) NOT NULL,
  expo_push_token VARCHAR(255) NULL,
  token_hash CHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (device_id),
  KEY idx_token_hash (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- migrate:down
-- Destructive: this table holds live push registration tokens for every
-- install. See db/README.md - never run a rollback against production.
DROP TABLE IF EXISTS notification_devices;
