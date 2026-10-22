CREATE TABLE IF NOT EXISTS upgrades (
 id BIGSERIAL PRIMARY KEY,
 upgrade_name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 upgrade_content TEXT NOT NULL DEFAULT '',
 number_active_upgrades INTEGER NOT NULL DEFAULT 0

)