CREATE TABLE IF NOT EXISTS farmer_ai_conversations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  farmer_id VARCHAR(36) NOT NULL,
  crop_name VARCHAR(160) NOT NULL,
  planting_date VARCHAR(10) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_farmer_ai_conversations_farmer
    FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY farmer_ai_conversations_farmer_updated_idx (farmer_id, updated_at)
);

CREATE TABLE IF NOT EXISTS farmer_ai_messages (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  sender ENUM('farmer', 'assistant') NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_farmer_ai_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES farmer_ai_conversations(id) ON DELETE CASCADE,
  KEY farmer_ai_messages_conversation_created_idx (conversation_id, created_at)
);
