import { MigrationInterface, QueryRunner } from "typeorm";

interface ColumnGroupConfig {
  label: string;
  columnKeys: string[];
}

export class UpdateJobSheetsColumnGroups1774100000000
  implements MigrationInterface
{
  name = "UpdateJobSheetsColumnGroups1774100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Look up adamwhitehouse user_id
    const users: Array<{ user_id: number }> = await queryRunner.query(
      `SELECT user_id FROM credentials WHERE user_name = 'adamwhitehouse' LIMIT 1`,
    );

    if (!users.length) return;
    const userId = users[0].user_id;

    // Look up the "Job Sheets" group
    const groups: Array<{ id: number }> = await queryRunner.query(
      `SELECT id FROM custom_order_view_groups WHERE user_id = $1 AND name = 'Job Sheets' LIMIT 1`,
      [userId],
    );

    if (!groups.length) return;
    const groupId = groups[0].id;

    const viewGroups: Array<{
      name: string;
      tabOrder: number;
      columnGroups: ColumnGroupConfig[];
    }> = [
      {
        name: "SADDLERS",
        tabOrder: 0,
        columnGroups: [
          {
            label: "SEAT",
            columnKeys: [
              "seatLeather",
              "inlaid",
              "skirt",
              "gulletLeather",
              "welt",
            ],
          },
          { label: "CANTLE", columnKeys: ["cantle", "stitch"] },
          {
            label: "FLAPS",
            columnKeys: [
              "flapLeather",
              "flapLength",
              "flapRollType",
              "rollLeather",
              "loops",
            ],
          },
          {
            label: "PANEL",
            columnKeys: [
              "frontFacing",
              "rearFacing",
              "gussetLeather",
              "frontGusset",
              "backGusset",
            ],
          },
        ],
      },
      {
        name: "Seaming Prep",
        tabOrder: 1,
        columnGroups: [
          { label: "SEAT", columnKeys: ["seatLeather", "seatOptions"] },
          {
            label: "CANTLE",
            columnKeys: ["skirt", "gulletLeather", "welt", "cantle", "stitch"],
          },
        ],
      },
      {
        name: "Panels",
        tabOrder: 2,
        columnGroups: [
          {
            label: "PANELS",
            columnKeys: [
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
            ],
          },
        ],
      },
      {
        name: "CUTTING",
        tabOrder: 3,
        columnGroups: [],
      },
      {
        name: "TREES",
        tabOrder: 4,
        columnGroups: [],
      },
    ];

    for (const view of viewGroups) {
      await queryRunner.query(
        `UPDATE custom_order_views
         SET column_groups = $1::jsonb
         WHERE user_id = $2 AND group_id = $3 AND tab_order = $4`,
        [JSON.stringify(view.columnGroups), userId, groupId, view.tabOrder],
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

    // Reset all column_groups to empty array
    await queryRunner.query(
      `UPDATE custom_order_views SET column_groups = '[]'::jsonb WHERE user_id = $1`,
      [userId],
    );
  }
}
