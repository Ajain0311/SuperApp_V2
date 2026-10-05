# Image storage

User-uploaded photos are compressed on the API and stored in PostgreSQL. This path does not use MinIO, Azure Blob, S3, Cloudinary, or any other object store.

The repository did not already have a `DocumentNo` / `BlobObject` table. Existing marketplace, food, and profile images were URL strings. A minimal `documents` table was added, and those URL columns now point at it when a user uploads a photo.

## Table `documents`

| Column | Type |
| --- | --- |
| `document_no` | `varchar(40)`, unique, server-generated `DOC-` + 16 hex chars |
| `document_name` | `varchar(255)`, sanitized file name |
| `blob_object` | `bytea`, compressed JPEG bytes |
| `owner_user_id` | owner, required for delete |

`blob_object` is not indexed and is not selected by restaurant or listing list queries. Those APIs keep returning an image URL only.

## Processing

- Max upload: 8 MB
- Max input edge: 8000 px
- Output: JPEG quality 70, longest edge 1280 px
- Orientation is corrected before resize
- One optimized image is stored. List and detail both use that URL
- Corrupt files, non-images, and oversized images are rejected

## API

- `POST /api/documents` multipart field `file`. Owner only. Optional `?assign=profile` writes the URL onto the user.
- `GET /api/documents/{documentNo}/image` returns `image/jpeg` with `Cache-Control: public, max-age=86400`.
- `DELETE /api/documents/{documentNo}` owner or admin. Removing a marketplace listing also deletes document rows referenced by that listing.

Migration: `database/migrations/20261005_documents_bytea.sql`. The API also creates the table on startup.

## Measured compression

Automated JPEG, 1800×1200, quality 95 source:

- Original: 1,574,396 bytes
- Stored JPEG quality 70, edge capped at 1280: 206,153 bytes
- Reduction: about 87%

A phone gallery upload of 2–5 MB was not run. No Android device was attached to this machine.

## App

Add Listing has **Upload photo from gallery**. The stored absolute image URL is sent as the listing `imageUrls` value. Restaurant and menu photos that are still remote catalog URLs are unchanged.
