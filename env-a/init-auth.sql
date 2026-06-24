CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

INSERT INTO users (username, email, password_hash) VALUES
('testuser1', 'test1@example.com', '$2b$10$XQvQn6FnBpZzQkY6fQhJQO9ZxYzAbCdEfGhIjKlMnOpQrStUvWxYz'),
('testuser2', 'test2@example.com', '$2b$10$XQvQn6FnBpZzQkY6fQhJQO9ZxYzAbCdEfGhIjKlMnOpQrStUvWxYz'),
('testuser3', 'test3@example.com', '$2b$10$XQvQn6FnBpZzQkY6fQhJQO9ZxYzAbCdEfGhIjKlMnOpQrStUvWxYz'),
('testuser4', 'test4@example.com', '$2b$10$XQvQn6FnBpZzQkY6fQhJQO9ZxYzAbCdEfGhIjKlMnOpQrStUvWxYz'),
('testuser5', 'test5@example.com', '$2b$10$XQvQn6FnBpZzQkY6fQhJQO9ZxYzAbCdEfGhIjKlMnOpQrStUvWxYz')
ON CONFLICT (username) DO NOTHING;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();