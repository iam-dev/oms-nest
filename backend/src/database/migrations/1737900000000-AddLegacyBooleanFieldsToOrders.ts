import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddLegacyBooleanFieldsToOrders1737900000000
  implements MigrationInterface
{
  name = "AddLegacyBooleanFieldsToOrders1737900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("orders");
    if (!table) {
      throw new Error("orders table not found");
    }

    // Add boolean columns for legacy order flags
    const booleanColumns = [
      "rushed",
      "repair",
      "demo",
      "sponsored",
      "fitter_stock",
      "custom_order",
    ];

    // Use pg_catalog for reliable type detection (information_schema can be unreliable)
    const columnsNeedingConversion: string[] = [];

    for (const col of booleanColumns) {
      const columnInfo = await queryRunner.query(
        `SELECT t.typname as data_type
         FROM pg_catalog.pg_attribute a
         JOIN pg_catalog.pg_type t ON a.atttypid = t.oid
         JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
         JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
         WHERE n.nspname = 'public'
           AND c.relname = 'orders'
           AND a.attname = $1
           AND a.attnum > 0
           AND NOT a.attisdropped`,
        [col],
      );
      if (columnInfo.length > 0) {
        const dataType = columnInfo[0].data_type.toLowerCase();
        // Skip if already boolean
        if (dataType === "bool" || dataType === "boolean") {
          continue;
        }
        // Check for integer types (int2=smallint, int4=integer, int8=bigint)
        if (
          ["int2", "int4", "int8", "smallint", "integer", "bigint"].includes(
            dataType,
          )
        ) {
          columnsNeedingConversion.push(col);
        }
      }
    }

    // If we need to convert columns, we must drop dependent objects first
    if (columnsNeedingConversion.length > 0) {
      // Drop any existing partial indexes on these columns (they may have integer comparisons)
      for (const col of columnsNeedingConversion) {
        // Find and drop indexes that reference this column
        const indexes = await queryRunner.query(
          `SELECT indexname FROM pg_indexes
           WHERE schemaname = 'public'
             AND tablename = 'orders'
             AND indexdef LIKE '%' || $1 || '%'`,
          [col],
        );
        for (const idx of indexes) {
          if (!/^[a-zA-Z0-9_]+$/.test(idx.indexname)) {
            throw new Error(`Invalid index name: ${idx.indexname}`);
          }
          await queryRunner.query(`DROP INDEX IF EXISTS "${idx.indexname}"`);
        }
      }

      // Drop materialized views that depend on these columns
      await queryRunner.query(
        `DROP MATERIALIZED VIEW IF EXISTS order_edit_view CASCADE`,
      );
      await queryRunner.query(
        `DROP MATERIALIZED VIEW IF EXISTS enriched_order_view CASCADE`,
      );

      // Convert columns from smallint to boolean
      // Cast to text first to handle both integer (0/1) and boolean (true/false) values
      for (const col of columnsNeedingConversion) {
        await queryRunner.query(`
          ALTER TABLE "orders"
          ALTER COLUMN "${col}" DROP DEFAULT,
          ALTER COLUMN "${col}" TYPE boolean USING CASE WHEN "${col}"::text IN ('0', 'false', 'f') THEN false ELSE true END,
          ALTER COLUMN "${col}" SET DEFAULT false
        `);
      }

      // Recreate the materialized views (same definitions as CreateEnrichedOrderViews migration)
      await this.recreateEnrichedOrderViews(queryRunner);
    }

    // Add any missing columns as boolean
    for (const col of booleanColumns) {
      const existingColumn = table.findColumnByName(col);
      if (!existingColumn) {
        await queryRunner.addColumn(
          "orders",
          new TableColumn({
            name: col,
            type: "boolean",
            default: false,
          }),
        );
      }
    }

    // Add changed timestamp column (Unix timestamp as bigint)
    if (!table.findColumnByName("changed")) {
      await queryRunner.addColumn(
        "orders",
        new TableColumn({
          name: "changed",
          type: "bigint",
          isNullable: true,
        }),
      );
    }

    // Add partial index for rushed orders (common filter)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_orders_rushed" ON "orders" ("rushed") WHERE "rushed" = true`,
    );

    // Add partial index for repair orders
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_orders_repair" ON "orders" ("repair") WHERE "repair" = true`,
    );

    // Add partial index for demo orders
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_orders_demo" ON "orders" ("demo") WHERE "demo" = true`,
    );
  }

  /**
   * Recreates the materialized views that were dropped during column type conversion.
   * This mirrors the definitions from CreateEnrichedOrderViews1737000000000 migration.
   */
  private async recreateEnrichedOrderViews(
    queryRunner: QueryRunner,
  ): Promise<void> {
    // Recreate enriched_order_view
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW enriched_order_view AS
      SELECT
        o.id,
        o.id as order_id,
        o.order_status,
        o.order_time,
        o.payment_time,
        o.rushed as is_urgent,
        o.fitter_reference,
        o.special_notes,
        o.serial_number,
        o.custom_order,
        o.repair,
        o.demo,
        o.sponsored,
        o.order_step,
        o.currency,
        o.name as order_name,
        o.horse_name,
        o.address as order_address,
        o.city as order_city,
        o.state as order_state,
        o.zipcode as order_zipcode,
        o.country as order_country,
        o.phone_no as order_phone,
        o.cell_no as order_cell,
        o.email as order_email,
        o.ship_name,
        o.ship_address,
        o.ship_city,
        o.ship_state,
        o.ship_zipcode,
        o.ship_country,
        o.price_saddle,
        o.price_tradein,
        o.price_deposit,
        o.price_discount,
        o.price_fittingeval,
        o.price_callfee,
        o.price_girth,
        o.price_shipping,
        o.price_tax,
        o.price_additional,
        (o.price_saddle - o.price_tradein - o.price_deposit - o.price_discount +
         o.price_fittingeval + o.price_callfee + o.price_girth +
         o.price_shipping + o.price_tax + o.price_additional) as total_price,
        c.id as customer_id,
        c.name as customer_name,
        c.email as customer_email,
        c.address as customer_address,
        c.city as customer_city,
        c.state as customer_state,
        c.zipcode as customer_zipcode,
        c.country as customer_country,
        c.phone_no as customer_phone,
        c.cell_no as customer_cell,
        c.horse_name as customer_horse_name,
        f.id as fitter_id,
        fc.full_name as fitter_name,
        fc.user_name as fitter_username,
        f.emailaddress as fitter_email,
        f.address as fitter_address,
        f.city as fitter_city,
        f.state as fitter_state,
        f.zipcode as fitter_zipcode,
        f.country as fitter_country,
        f.phone_no as fitter_phone,
        f.cell_no as fitter_cell,
        fa.id as factory_id,
        fac.full_name as factory_name,
        fac.user_name as factory_username,
        fa.emailaddress as factory_email,
        fa.address as factory_address,
        fa.city as factory_city,
        fa.state as factory_state,
        fa.zipcode as factory_zipcode,
        fa.country as factory_country,
        fa.phone_no as factory_phone,
        fa.cell_no as factory_cell,
        s.id as saddle_id,
        s.brand as brand_name,
        s.model_name,
        s.type as saddle_type,
        lt.id as leather_id,
        lt.name as leather_name,
        st.name as status_name,
        st.sequence as status_sequence
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN fitters f ON o.fitter_id = f.id
      LEFT JOIN credentials fc ON f.user_id = fc.user_id
      LEFT JOIN factories fa ON o.factory_id = fa.id
      LEFT JOIN credentials fac ON fa.user_id = fac.user_id
      LEFT JOIN saddles s ON o.saddle_id = s.id
      LEFT JOIN leather_types lt ON o.leather_id = lt.id
      LEFT JOIN statuses st ON o.order_status = st.id
    `);

    // Create indexes on enriched_order_view
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_enriched_order_view_id ON enriched_order_view (id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_enriched_order_view_customer ON enriched_order_view (customer_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_enriched_order_view_fitter ON enriched_order_view (fitter_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_enriched_order_view_factory ON enriched_order_view (factory_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_enriched_order_view_status ON enriched_order_view (order_status)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_enriched_order_view_order_time ON enriched_order_view (order_time DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_enriched_order_view_customer_name ON enriched_order_view (customer_name)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_enriched_order_view_fitter_name ON enriched_order_view (fitter_name)
    `);

    // Recreate order_edit_view
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW order_edit_view AS
      SELECT
        o.id,
        o.id as order_id,
        o.order_status,
        o.order_time,
        o.fitter_reference,
        o.special_notes,
        c.id as customer_id,
        c.name as customer_name,
        f.id as fitter_id,
        fc.full_name as fitter_name,
        fa.id as factory_id,
        fac.full_name as factory_name,
        s.id as saddle_id,
        s.brand as brand_name,
        s.model_name,
        lt.id as leather_id,
        lt.name as leather_name,
        o.price_saddle,
        o.price_tradein,
        o.price_deposit,
        o.price_discount,
        o.price_fittingeval,
        o.price_callfee,
        o.price_girth,
        o.price_shipping,
        o.price_tax,
        o.price_additional,
        o.order_data
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN fitters f ON o.fitter_id = f.id
      LEFT JOIN credentials fc ON f.user_id = fc.user_id
      LEFT JOIN factories fa ON o.factory_id = fa.id
      LEFT JOIN credentials fac ON fa.user_id = fac.user_id
      LEFT JOIN saddles s ON o.saddle_id = s.id
      LEFT JOIN leather_types lt ON o.leather_id = lt.id
    `);

    // Create index on order_edit_view
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_order_edit_view_id ON order_edit_view (id)
    `);

    // Recreate refresh functions
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION refresh_enriched_order_view()
      RETURNS void AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY enriched_order_view;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION refresh_order_edit_view()
      RETURNS void AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY order_edit_view;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION refresh_all_order_views()
      RETURNS void AS $$
      BEGIN
        PERFORM refresh_enriched_order_view();
        PERFORM refresh_order_edit_view();
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION trigger_refresh_enriched_views()
      RETURNS trigger AS $$
      BEGIN
        PERFORM pg_advisory_xact_lock(hashtext('refresh_enriched_views'));
        PERFORM refresh_all_order_views();
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `);

    // Grant permissions
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION refresh_enriched_order_view() TO PUBLIC`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION refresh_order_edit_view() TO PUBLIC`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION refresh_all_order_views() TO PUBLIC`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_rushed"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_repair"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_demo"`);

    // Drop columns
    const columns = [
      "rushed",
      "repair",
      "demo",
      "sponsored",
      "fitter_stock",
      "custom_order",
      "changed",
    ];

    for (const col of columns) {
      await queryRunner.dropColumn("orders", col);
    }
  }
}
