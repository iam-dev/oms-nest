/**
 * Shared SQL for the "user" view definition.
 *
 * The "user" view is built on top of the "credentials" table and is
 * recreated by multiple migrations. Keep this in one place so the
 * DDL stays consistent.
 */

/** View with email populated from user_name (current / latest). */
export const USER_VIEW_WITH_EMAIL = `
  CREATE VIEW "user" AS
  SELECT
    uuid_generate_v5(uuid_ns_oid(), user_id::text) AS id,
    user_id AS legacy_id,
    last_login,
    user_name AS username,
    password_hash AS password,
    password_reset_hash AS reset_token,
    password_reset_valid_to AS reset_token_expires_at,
    (blocked = 0) AS enabled,
    user_name AS email,
    NULL::varchar AS address,
    NULL::varchar AS city,
    NULL::varchar AS zipcode,
    NULL::varchar AS state,
    NULL::varchar AS cell_no,
    NULL::varchar AS phone_no,
    NULL::varchar AS country,
    'USD'::varchar AS currency,
    full_name AS name,
    user_type,
    supervisor AS is_supervisor,
    CURRENT_TIMESTAMP AS created_at,
    CURRENT_TIMESTAMP AS updated_at,
    CASE WHEN deleted = 1 THEN CURRENT_TIMESTAMP ELSE NULL END AS deleted_at
  FROM credentials
`;

/** View with NULL email (used by older migrations and rollbacks). */
export const USER_VIEW_NULL_EMAIL = `
  CREATE VIEW "user" AS
  SELECT
    uuid_generate_v5(uuid_ns_oid(), user_id::text) AS id,
    user_id AS legacy_id,
    last_login,
    user_name AS username,
    password_hash AS password,
    password_reset_hash AS reset_token,
    password_reset_valid_to AS reset_token_expires_at,
    (blocked = 0) AS enabled,
    NULL::varchar AS email,
    NULL::varchar AS address,
    NULL::varchar AS city,
    NULL::varchar AS zipcode,
    NULL::varchar AS state,
    NULL::varchar AS cell_no,
    NULL::varchar AS phone_no,
    NULL::varchar AS country,
    'USD'::varchar AS currency,
    full_name AS name,
    user_type,
    supervisor AS is_supervisor,
    CURRENT_TIMESTAMP AS created_at,
    CURRENT_TIMESTAMP AS updated_at,
    CASE WHEN deleted = 1 THEN CURRENT_TIMESTAMP ELSE NULL END AS deleted_at
  FROM credentials
`;

export const DROP_USER_VIEW = `DROP VIEW IF EXISTS "user"`;
