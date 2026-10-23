-- Add client_message_id column for robust message deduplication
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS client_message_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_chat_messages_client_id ON chat_messages(client_message_id);
