CREATE TABLE IF NOT EXISTS user_has_upgrades (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    upgrade_id BIGINT NOT NULL REFERENCES upgrades(id) ON DELETE CASCADE,
    has_paid BOOLEAN DEFAULT FALSE,
    unlock BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (user_id, upgrade_id)
);