import { MigrationInterface, QueryRunner } from "typeorm";

interface ViewConfig {
  name: string;
  tabOrder: number;
  columns: Array<{
    key: string;
    label: string;
    visible: boolean;
    order: number;
  }>;
}

export class SeedJobSheetsForAdamWhitehouse1773100000000
  implements MigrationInterface
{
  name = "SeedJobSheetsForAdamWhitehouse1773100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Look up adamwhitehouse user_id
    const users: Array<{ user_id: number }> = await queryRunner.query(
      `SELECT user_id FROM credentials WHERE user_name = 'adamwhitehouse' LIMIT 1`,
    );

    if (!users.length) {
      // User not found — skip seeding (dev/CI environments may not have this user)
      return;
    }

    const userId = users[0].user_id;

    // Create the "Job Sheets" group
    const groups: Array<{ id: number }> = await queryRunner.query(
      `INSERT INTO custom_order_view_groups (user_id, name)
       VALUES ($1, 'Job Sheets')
       ON CONFLICT (user_id, name) DO UPDATE SET name = 'Job Sheets'
       RETURNING id`,
      [userId],
    );

    if (!groups.length) return;
    const groupId = groups[0].id;

    // Define the 5 tab views with their column configurations
    const views: ViewConfig[] = [
      {
        name: "SADDLERS",
        tabOrder: 0,
        columns: this.buildColumns([
          "id",
          "seatSize",
          "modelName",
          "leatherType",
          "seatLeather",
          "inlaid",
          "skirt",
          "gulletLeather",
          "welt",
          "cantle",
          "stitch",
          "flapLeather",
          "flapLength",
          "flapRollType",
          "rollLeather",
          "loops",
          "frontFacing",
          "rearFacing",
          "gussetLeather",
          "frontGusset",
          "backGusset",
          "notes",
        ]),
      },
      {
        name: "Seaming Prep",
        tabOrder: 1,
        columns: this.buildColumns([
          "id",
          "seatSize",
          "modelName",
          "leatherType",
          "seatLeather",
          "seatOptions",
          "skirt",
          "gulletLeather",
          "welt",
          "cantle",
          "stitch",
          "notes",
        ]),
      },
      {
        name: "Panels",
        tabOrder: 2,
        columns: this.buildColumns([
          "id",
          "seatSize",
          "modelName",
          "leatherType",
          "flapLength",
          "padRollType",
          "sweatFlap",
          "panelLeather",
          "panelMaterial",
          "backFacing",
          "frontFacing",
          "gussetLeather",
          "backGusset",
          "frontGusset",
          "notes",
        ]),
      },
      {
        name: "CUTTING",
        tabOrder: 3,
        columns: this.buildColumns([
          "id",
          "seatSize",
          "modelName",
          "leatherType",
          "flapLength",
          "flapLeather",
          "loops",
          "skirtBack",
          "padRollType",
          "padUnderPadTop",
          "sweatFlap",
          "seatLeather",
          "seatOptions",
          "panelLeather",
          "liningFoam",
          "backFacing",
          "frontFacing",
          "gussetLeather",
          "backGusset",
          "frontGusset",
          "cantle",
          "gulletLeather",
          "notes",
        ]),
      },
      {
        name: "TREES",
        tabOrder: 4,
        columns: this.buildColumns([
          "id",
          "bars",
          "modelName",
          "seatLeather",
          "seatSize",
          "treeSize",
          "stitch",
          "welt",
          "loops",
          "cantle",
        ]),
      },
    ];

    for (const view of views) {
      await queryRunner.query(
        `INSERT INTO custom_order_views (user_id, name, columns, is_default, group_id, tab_order)
         VALUES ($1, $2, $3::jsonb, false, $4, $5)
         ON CONFLICT DO NOTHING`,
        [
          userId,
          view.name,
          JSON.stringify(view.columns),
          groupId,
          view.tabOrder,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Look up adamwhitehouse user_id
    const users: Array<{ user_id: number }> = await queryRunner.query(
      `SELECT user_id FROM credentials WHERE user_name = 'adamwhitehouse' LIMIT 1`,
    );

    if (!users.length) return;
    const userId = users[0].user_id;

    // Delete the group (cascade will delete views)
    await queryRunner.query(
      `DELETE FROM custom_order_view_groups WHERE user_id = $1 AND name = 'Job Sheets'`,
      [userId],
    );
  }

  private buildColumns(
    keys: string[],
  ): Array<{ key: string; label: string; visible: boolean; order: number }> {
    const labelMap: Record<string, string> = {
      id: "Order ID",
      seatSize: "Seat Size",
      modelName: "Model",
      leatherType: "Leather Type",
      seatLeather: "Seat Leather",
      inlaid: "Inlaid",
      skirt: "Skirt",
      gulletLeather: "Gullet Leather",
      welt: "Welt",
      cantle: "Cantle",
      stitch: "Stitch",
      flapLeather: "Flap Leather",
      flapLength: "Flap Length",
      flapRollType: "Flap Roll Type",
      rollLeather: "Roll Leather",
      loops: "Loops",
      frontFacing: "Front Facing",
      rearFacing: "Rear Facing",
      backFacing: "Back Facing",
      gussetLeather: "Gusset Leather",
      frontGusset: "Front Gusset",
      backGusset: "Back Gusset",
      notes: "Notes",
      seatOptions: "Seat Options",
      padRollType: "Pad Roll Type",
      sweatFlap: "Sweat Flap",
      panelLeather: "Panel Leather",
      panelMaterial: "Panel Material",
      skirtBack: "Skirt Back",
      padUnderPadTop: "Pad/Under-Pad/Top",
      liningFoam: "Lining/Foam",
      bars: "Bars",
      treeSize: "Tree Size",
      brandName: "Brand",
    };

    return keys.map((key, i) => ({
      key,
      label: labelMap[key] || key,
      visible: true,
      order: i,
    }));
  }
}
