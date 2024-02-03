CREATE TABLE IF NOT EXISTS line_notify_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(255) NOT NULL,
  access_time TIMESTAMP NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent VARCHAR(255) NOT NULL
);

ALTER TABLE line_notify_tokens ADD notify_type INT NOT NULL DEFAULT 0;