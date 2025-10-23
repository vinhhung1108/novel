// apps/api/src/sources/sources.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { CreateSourceDto } from "./dto/create-source.dto";
import { UpdateSourceDto } from "./dto/update-source.dto";

type SourceRow = {
  id: string;
  name: string;
  base_url: string;
  created_at: string;
};

@Controller("sources")
export class SourcesController {
  constructor(private readonly ds: DataSource) {}

  @Get()
  async list(
    @Query("q") q?: string,
    @Query("limit") limit = "50",
    @Query("offset") offset = "0"
  ): Promise<Array<Pick<SourceRow, "id" | "name" | "base_url">>> {
    const lim = Math.max(1, Math.min(200, Number(limit) || 50));
    const off = Math.max(0, Number(offset) || 0);
    const args: any[] = [];
    let where = "";
    if (q && q.trim()) {
      where = `WHERE name ILIKE $1 OR base_url ILIKE $1`;
      args.push(`%${q.trim()}%`);
    }
    const rows: SourceRow[] = await this.ds.query(
      `
      SELECT id, name, base_url, created_at
      FROM source
      ${where}
      ORDER BY created_at DESC
      LIMIT ${lim} OFFSET ${off}
      `,
      args
    );
    return rows.map(({ id, name, base_url }) => ({ id, name, base_url }));
  }

  @Post()
  async create(@Body() dto: CreateSourceDto) {
    try {
      const rows = await this.ds.query(
        `
        INSERT INTO source(name, base_url)
        VALUES($1, $2)
        ON CONFLICT (base_url) DO UPDATE SET
          name = EXCLUDED.name
        RETURNING id, name, base_url, created_at
        `,
        [dto.name.trim(), dto.base_url.trim()]
      );
      return rows[0];
    } catch (e: any) {
      // trả về thông tin lỗi gọn
      const msg = e?.message || "Create failed";
      throw new Error(msg);
    }
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateSourceDto) {
    const fields: string[] = [];
    const args: any[] = [];
    let idx = 1;
    if (typeof dto.name === "string") {
      fields.push(`name = $${idx++}`);
      args.push(dto.name.trim());
    }
    if (typeof dto.base_url === "string") {
      fields.push(`base_url = $${idx++}`);
      args.push(dto.base_url.trim());
    }
    if (fields.length === 0) return { updated: false };

    args.push(id);
    const rows = await this.ds.query(
      `
      UPDATE source
      SET ${fields.join(", ")}
      WHERE id = $${idx}
      RETURNING id, name, base_url, created_at
      `,
      args
    );
    return rows[0] ?? { updated: false };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    // Lưu ý: nếu muốn chặn xóa khi đã có mapping series/chapters thì thêm kiểm tra trước
    const res = await this.ds.query(
      `DELETE FROM source WHERE id = $1 RETURNING id`,
      [id]
    );
    return { deleted: Boolean(res?.[0]?.id) };
  }
}
