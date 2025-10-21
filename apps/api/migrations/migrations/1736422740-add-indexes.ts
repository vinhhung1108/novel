import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexes17364227401761013174743 implements MigrationInterface {
  name = "AddIndexes17364227401761013174743";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_novels_title_lower ON public.novels USING gin (LOWER(title) gin_trgm_ops)`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_novels_slug_lower ON public.novels USING gin (LOWER(slug) gin_trgm_ops)`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_novel_categories_novel ON public.novel_categories (novel_id)`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_novel_tags_novel ON public.novel_tags (novel_id)`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_chapters_novel ON public.chapters (novel_id)`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_novel_views_by_date ON public.novel_views (view_date, novel_id)`
    );
    await queryRunner.query(
      `ALTER TABLE public.chapter_bodies
        ADD CONSTRAINT fk_chapter_bodies_chapter
        FOREIGN KEY (chapter_id)
        REFERENCES public.chapters(id)
        ON DELETE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE public.chapters
        ADD CONSTRAINT fk_chapters_novel
        FOREIGN KEY (novel_id)
        REFERENCES public.novels(id)
        ON DELETE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE public.novel_categories
        ADD CONSTRAINT fk_novel_categories_category
        FOREIGN KEY (category_id)
        REFERENCES public.categories(id)
        ON DELETE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE public.novel_categories
        ADD CONSTRAINT fk_novel_categories_novel
        FOREIGN KEY (novel_id)
        REFERENCES public.novels(id)
        ON DELETE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE public.novel_tags
        ADD CONSTRAINT fk_novel_tags_tag
        FOREIGN KEY (tag_id)
        REFERENCES public.tags(id)
        ON DELETE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE public.novel_tags
        ADD CONSTRAINT fk_novel_tags_novel
        FOREIGN KEY (novel_id)
        REFERENCES public.novels(id)
        ON DELETE CASCADE`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE public.novel_tags DROP CONSTRAINT IF EXISTS fk_novel_tags_novel`
    );
    await queryRunner.query(
      `ALTER TABLE public.novel_tags DROP CONSTRAINT IF EXISTS fk_novel_tags_tag`
    );
    await queryRunner.query(
      `ALTER TABLE public.novel_categories DROP CONSTRAINT IF EXISTS fk_novel_categories_novel`
    );
    await queryRunner.query(
      `ALTER TABLE public.novel_categories DROP CONSTRAINT IF EXISTS fk_novel_categories_category`
    );
    await queryRunner.query(
      `ALTER TABLE public.chapters DROP CONSTRAINT IF EXISTS fk_chapters_novel`
    );
    await queryRunner.query(
      `ALTER TABLE public.chapter_bodies DROP CONSTRAINT IF EXISTS fk_chapter_bodies_chapter`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_novel_views_by_date`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_chapters_novel`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_novel_tags_novel`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_novel_categories_novel`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_novels_slug_lower`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_novels_title_lower`
    );
  }
}
