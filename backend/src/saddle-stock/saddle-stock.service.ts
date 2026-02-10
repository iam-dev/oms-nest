import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { SaddleStockDto } from "./dto/saddle-stock.dto";

interface SaddleStockQueryResult {
  data: SaddleStockDto[];
  total: number;
  page: number;
  pages: number;
}

@Injectable()
export class SaddleStockService {
  private readonly logger = new Logger(SaddleStockService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findFitterByUserId(userId: string | number): Promise<number | null> {
    const result = await this.dataSource.query(
      `SELECT f.id FROM fitters f
       INNER JOIN "user" u ON f.user_id = u.legacy_id
       WHERE u.id = $1 AND f.deleted = 0 LIMIT 1`,
      [userId],
    );
    return result.length > 0 ? result[0].id : null;
  }

  async getSaddleStock(
    type: "my" | "available" | "all",
    userId: string | number,
    page: number = 1,
    limit: number = 30,
    search?: string,
  ): Promise<SaddleStockQueryResult> {
    const offset = (page - 1) * limit;

    let whereClause = `o.fitter_stock = true AND o.deleted_at IS NULL`;
    const params: any[] = [];
    let paramIndex = 1;

    if (type === "all") {
      // No fitter_id filtering — return all fitter stock
    } else {
      const fitterId = await this.findFitterByUserId(userId);

      if (fitterId && type === "my") {
        whereClause += ` AND o.fitter_id = $${paramIndex}`;
        params.push(fitterId);
        paramIndex++;
      } else if (fitterId && type === "available") {
        whereClause += ` AND o.fitter_id != $${paramIndex}`;
        params.push(fitterId);
        paramIndex++;
      }
    }

    if (search) {
      whereClause += ` AND (
        o.serial_number ILIKE $${paramIndex}
        OR s.brand ILIKE $${paramIndex}
        OR s.model_name ILIKE $${paramIndex}
        OR cr.full_name ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM orders o
      LEFT JOIN saddles s ON o.saddle_id = s.id
      LEFT JOIN fitters f ON o.fitter_id = f.id
      LEFT JOIN credentials cr ON f.user_id = cr.user_id
      WHERE ${whereClause}
    `;

    const dataQuery = `
      SELECT
        o.id,
        o.serial_number,
        o.fitter_stock,
        o.demo,
        o.custom_order,
        o.order_status,
        o.sponsored,
        o.order_time,
        o.created_at,
        s.brand AS saddle_brand,
        s.model_name AS saddle_model_name,
        lt.name AS leather_type_name,
        f.id AS fitter_id,
        cr.full_name AS owner_name
      FROM orders o
      LEFT JOIN saddles s ON o.saddle_id = s.id
      LEFT JOIN leather_types lt ON o.leather_id = lt.id
      LEFT JOIN fitters f ON o.fitter_id = f.id
      LEFT JOIN credentials cr ON f.user_id = cr.user_id
      WHERE ${whereClause}
      ORDER BY o.id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataParams = [...params, limit, offset];

    try {
      const [countResult, rows] = await Promise.all([
        this.dataSource.query(countQuery, params),
        this.dataSource.query(dataQuery, dataParams),
      ]);

      const total = parseInt(countResult[0]?.total || "0", 10);
      const pages = Math.ceil(total / limit);

      const data: SaddleStockDto[] = rows.map((row: any) => {
        const brandName = row.saddle_brand || "";
        const modelName = row.saddle_model_name || "";
        const name = [brandName, modelName].filter(Boolean).join(" ");

        let createdAt: string;
        if (row.order_time) {
          createdAt = new Date(row.order_time * 1000).toISOString();
        } else if (row.created_at) {
          createdAt = new Date(row.created_at).toISOString();
        } else {
          createdAt = new Date().toISOString();
        }

        return {
          id: row.id,
          serial: row.serial_number || "",
          name,
          stock: row.fitter_stock ? 1 : 0,
          stockOwner: row.fitter_id
            ? { id: row.fitter_id, name: row.owner_name || "" }
            : undefined,
          model: { name: modelName },
          leatherType: row.leather_type_name
            ? { name: row.leather_type_name }
            : undefined,
          demo: Boolean(row.demo),
          customizableProduct: Boolean(row.custom_order),
          productHasBeenOrdered: (row.order_status || 0) > 0,
          sponsored: Boolean(row.sponsored),
          createdAt,
        };
      });

      return { data, total, page, pages };
    } catch (error) {
      this.logger.error("Failed to query saddle stock", error);
      throw error;
    }
  }
}
