CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE,
  card_color TEXT DEFAULT '#cddc39',
  completed BOOLEAN DEFAULT FALSE,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_completed ON todos(completed);
CREATE INDEX idx_todos_due_date ON todos(due_date);
CREATE INDEX idx_todos_user_completed ON todos(user_id, completed);

INSERT INTO todos (user_id, title, description, due_date, priority) VALUES
(1, 'Belajar Docker Compose', 'Mempelajari dasar-dasar Docker Compose', '2024-12-31', 2),
(1, 'Setup Environment Eksperimen', 'Menyiapkan lingkungan A untuk penelitian', '2024-12-28', 1),
(2, 'Review Kode', 'Melakukan code review untuk pull request', '2024-12-29', 2),
(3, 'Update Dokumentasi', 'Memperbarui dokumentasi API', '2024-12-30', 3),
(4, 'Testing Load', 'Menjalankan JMeter load testing', '2024-12-27', 1)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION update_todos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  IF NEW.completed = TRUE AND OLD.completed = FALSE THEN
    NEW.completed_at = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_todos_updated_at
BEFORE UPDATE ON todos
FOR EACH ROW
EXECUTE FUNCTION update_todos_updated_at();