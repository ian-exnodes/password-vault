#!/usr/bin/env bash
set -euo pipefail

source_container="password-vault-backup-source-$$"
restore_container="password-vault-backup-restore-$$"
verification_dir="$(mktemp -d "${TMPDIR:-/tmp}/password-vault-backup.XXXXXX")"
backup_file="$verification_dir/vault.dump"
postgres_image="postgres:17.6-alpine"

cleanup() {
  docker rm -f "$source_container" "$restore_container" >/dev/null 2>&1 || true
  if [[ -f "$backup_file" ]]; then rm -f "$backup_file"; fi
  rmdir "$verification_dir" 2>/dev/null || true
}
trap cleanup EXIT

start_database() {
  local container="$1"
  docker run --detach --name "$container" \
    --env POSTGRES_PASSWORD=verification-only \
    --env POSTGRES_DB=password_vault \
    "$postgres_image" >/dev/null
  local attempt
  for attempt in $(seq 1 30); do
    if docker exec "$container" pg_isready --username postgres --dbname password_vault >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "PostgreSQL did not become ready" >&2
  return 1
}

apply_migrations() {
  local container="$1"
  local migration
  for migration in drizzle/*.sql; do
    docker exec --interactive "$container" psql --set ON_ERROR_STOP=1 --username postgres --dbname password_vault < "$migration" >/dev/null
  done
}

manifest() {
  local container="$1"
  docker exec "$container" psql --tuples-only --no-align --username postgres --dbname password_vault --command \
    "select count(*) || ':' || coalesce(sum(revision), 0) || ':' || md5(coalesce(string_agg(id::text || ':' || revision || ':' || nonce || ':' || ciphertext, '|' order by id), '')) from vault_items;"
}

start_database "$source_container"
apply_migrations "$source_container"

docker exec --interactive "$source_container" psql --set ON_ERROR_STOP=1 --username postgres --dbname password_vault >/dev/null <<'SQL'
insert into users (id, email) values ('00000000-0000-4000-8000-000000000001', 'backup-fixture@example.test');
insert into vaults (id, user_id, master_envelope, recovery_envelope, crypto_version) values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '{"format":"password-vault-key-envelope","version":1,"purpose":"master","ciphertext":"encrypted-master-fixture"}',
  '{"format":"password-vault-key-envelope","version":1,"purpose":"recovery","ciphertext":"encrypted-recovery-fixture"}',
  1
);
insert into vault_items (id, vault_id, ciphertext, nonce, crypto_version, revision) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'AAAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAA', 1, 1),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'BBBBBBBBBBBBBBBBBBBBBBB', 'BBBBBBBBBBBBBBBB', 1, 7);
SQL

source_manifest="$(manifest "$source_container")"
docker exec "$source_container" pg_dump --format=custom --no-owner --no-privileges --username postgres --dbname password_vault > "$backup_file"
test -s "$backup_file"

start_database "$restore_container"
docker exec --interactive "$restore_container" pg_restore --exit-on-error --no-owner --no-privileges --username postgres --dbname password_vault < "$backup_file" >/dev/null
restore_manifest="$(manifest "$restore_container")"

if [[ "$source_manifest" != "$restore_manifest" ]]; then
  echo "Backup manifest mismatch: source=$source_manifest restore=$restore_manifest" >&2
  exit 1
fi

actual_columns="$(docker exec "$restore_container" psql --tuples-only --no-align --username postgres --dbname password_vault --command \
  "select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='vault_items';")"
expected_columns="id,vault_id,ciphertext,nonce,crypto_version,revision,created_at,updated_at,deleted_at"
if [[ "$actual_columns" != "$expected_columns" ]]; then
  echo "Unexpected vault_items schema: $actual_columns" >&2
  exit 1
fi

echo "backup-restore PASS manifest=$restore_manifest image=$postgres_image"
