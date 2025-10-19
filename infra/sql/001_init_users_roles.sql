-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- roles
CREATE TABLE IF NOT EXISTS roles (
id serial PRIMARY KEY,
code text UNIQUE NOT NULL,
name text NOT NULL
);


-- users
CREATE TABLE IF NOT EXISTS users (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
email citext UNIQUE NOT NULL,
username citext UNIQUE NOT NULL,
password_hash text NOT NULL,
status smallint NOT NULL DEFAULT 1,
display_name text,
avatar_url text,
bio text,
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now()
);


-- user_roles
CREATE TABLE IF NOT EXISTS user_roles (
user_id uuid REFERENCES users(id) ON DELETE CASCADE,
role_id int REFERENCES roles(id) ON DELETE CASCADE,
PRIMARY KEY(user_id, role_id)
);


-- seed roles
INSERT INTO roles(code, name) VALUES
('admin','Administrator'),
('moderator','Moderator'),
('editor','Editor'),
('author','Author'),
('user','User')
ON CONFLICT (code) DO NOTHING;