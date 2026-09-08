CREATE TABLE IF NOT EXISTS business_users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tinode_uid text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS membership_levels (
 code text PRIMARY KEY, name text NOT NULL,
 reward_units bigint NOT NULL CHECK(reward_units>=0)
);
INSERT INTO membership_levels VALUES ('ordinary','普通用户',10)
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS memberships (
 user_id uuid PRIMARY KEY REFERENCES business_users(id),
 level_code text NOT NULL REFERENCES membership_levels(code),
 starts_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 enabled boolean NOT NULL DEFAULT true,
 CHECK(expires_at>starts_at)
);
CREATE TABLE IF NOT EXISTS checkin_rules (
 id integer PRIMARY KEY CHECK(id=1), enabled boolean NOT NULL,
 timezone text NOT NULL, unit text NOT NULL, revision integer NOT NULL
);
INSERT INTO checkin_rules VALUES (1,true,'Asia/Shanghai','测试积分',1)
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS checkins (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES business_users(id),
 business_date date NOT NULL,
 reward_units bigint NOT NULL CHECK(reward_units>=0),
 level_code text NOT NULL,
 rule_snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,business_date)
);
CREATE TABLE IF NOT EXISTS reward_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES business_users(id),
 checkin_id uuid NOT NULL UNIQUE REFERENCES checkins(id),
 amount bigint NOT NULL CHECK(amount>=0), unit text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS business_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor uuid REFERENCES business_users(id), action text NOT NULL,
 details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_audit_actor_date ON business_audit(actor,created_at DESC);
