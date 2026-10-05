-- User images live in PostgreSQL. blob_object is compressed JPEG bytes.
CREATE TABLE IF NOT EXISTS documents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_no VARCHAR(40) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    blob_object BYTEA NOT NULL,
    owner_user_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_documents_document_no UNIQUE (document_no),
    CONSTRAINT fk_documents_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents (owner_user_id);
