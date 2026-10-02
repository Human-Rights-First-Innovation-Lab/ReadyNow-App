-- migrate:up
-- Emergency alert delivery. See ALERT-DELIVERY-DESIGN.md.
--
-- These tables are a delivery queue, not an archive. Plan-derived plaintext
-- (recipient numbers and message bodies) exists only for as long as delivery
-- takes, and is purged on a short window. The only record that outlives an
-- alert is alert_stats_daily, which carries no user or alert identifiers and
-- therefore cannot be joined against anything.

-- Per-install credential used to authenticate alert calls.
-- Registered at account creation, proven at that moment by a valid Auth0 token.
-- Chosen over the Auth0 access token itself because tokens expire, and someone
-- detained weeks after last opening the app must still be able to fire.
CREATE TABLE IF NOT EXISTS device_credentials (
  credential_id CHAR(36)    NOT NULL PRIMARY KEY,
  user_id       VARCHAR(64) NOT NULL,
  secret_hash   CHAR(64)    NOT NULL,           -- sha256 of the 32-byte secret
  created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at  TIMESTAMP   NULL,
  revoked_at    TIMESTAMP   NULL,
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alerts (
  alert_id      CHAR(36)      NOT NULL PRIMARY KEY,
  user_id       VARCHAR(64)   NOT NULL,
  state         ENUM('staged','fired','complete','exhausted') NOT NULL DEFAULT 'staged',
  -- Ciphertext is written at stage time and is undecryptable until fire
  -- supplies the key. Both are cleared as soon as the plan is expanded.
  ciphertext    MEDIUMBLOB    NULL,
  enc_key       VARBINARY(64) NULL,
  plan_hash     CHAR(64)      NULL,
  content_hash  CHAR(64)      NULL,            -- dedupe key, excludes location
  location_lat  DECIMAL(9,6)  NULL,
  location_lng  DECIMAL(9,6)  NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fired_at      TIMESTAMP     NULL,
  completed_at  TIMESTAMP     NULL,
  purge_after   TIMESTAMP     NOT NULL,
  KEY idx_state_purge (state, purge_after),
  KEY idx_dedupe      (user_id, content_hash, fired_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alert_messages (
  id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  alert_id        CHAR(36)     NOT NULL,
  -- Both NULLed at purge; the row survives briefly so counters stay accurate.
  recipient       VARCHAR(32)  NULL,           -- E.164
  body            MEDIUMTEXT   NULL,
  status          ENUM('pending','sent','delivered','failed','optout','exhausted')
                    NOT NULL DEFAULT 'pending',
  attempts        SMALLINT     NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMP    NULL,
  message_sid     VARCHAR(64)  NULL,           -- NULL means Twilio never accepted it
  last_error      VARCHAR(255) NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_alert (alert_id, status),
  KEY idx_retry (status, next_attempt_at),
  KEY idx_sid   (message_sid),
  CONSTRAINT fk_alert_messages_alert
    FOREIGN KEY (alert_id) REFERENCES alerts(alert_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The only thing that outlives an alert. No user_id, no alert_id, no SIDs,
-- so it cannot be used to reconstruct who was contacted.
CREATE TABLE IF NOT EXISTS alert_stats_daily (
  stat_date          DATE NOT NULL PRIMARY KEY,
  alerts_fired       INT  NOT NULL DEFAULT 0,
  messages_created   INT  NOT NULL DEFAULT 0,
  messages_delivered INT  NOT NULL DEFAULT 0,
  messages_failed    INT  NOT NULL DEFAULT 0,
  messages_optout    INT  NOT NULL DEFAULT 0,  -- 21610; expected, not a fault
  messages_exhausted INT  NOT NULL DEFAULT 0,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                       ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Liveness for the GitHub Actions sweep. Scheduled workflows are disabled in
-- public repositories after 60 days without commits, so a stale row here means
-- the retry clock has stopped. Alerting on this is required, not optional.
CREATE TABLE IF NOT EXISTS ops_heartbeat (
  name        VARCHAR(32) NOT NULL PRIMARY KEY,
  last_run_at TIMESTAMP   NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
-- Destructive: drops in dependency order. alert_messages has a foreign
-- key to alerts, so it goes first. See db/README.md before running this.
DROP TABLE IF EXISTS alert_messages;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS alert_stats_daily;
DROP TABLE IF EXISTS device_credentials;
DROP TABLE IF EXISTS ops_heartbeat;
