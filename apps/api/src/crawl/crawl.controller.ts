import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  BadRequestException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { plainToInstance, Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  validateSync,
} from "class-validator";
import { CrawlQueue } from "./crawl.queue";
import type { Job, Queue } from "bullmq";
import { ensureCrawlSchema } from "./schema";

class ListSourceQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
}

class CreateSourceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  baseUrl!: string;
}

class EnqueueSeriesDto {
  @IsUUID()
  sourceId!: string;

  @IsString()
  @IsNotEmpty()
  extSeriesId!: string;

  @IsString()
  @IsNotEmpty()
  url!: string;
}

class EnqueueChapterDto {
  @IsUUID()
  sourceId!: string;

  @IsUUID()
  seriesId!: string;

  @IsString()
  @IsNotEmpty()
  extChapterId!: string;

  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  indexNo?: number;
}

class JobStatusQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

type JobState = "waiting" | "active" | "delayed" | "failed" | "completed";

type JobPayload = {
  id: string;
  name: string;
  status: JobState;
  attemptsMade: number;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  progress: number | null;
  failedReason: string | null;
  data: unknown;
  returnValue: unknown;
  stacktrace: string[];
};

type QueueJobSummary = Record<JobState, JobPayload[]>;

const JOB_STATES: JobState[] = [
  "waiting",
  "active",
  "delayed",
  "failed",
  "completed",
];

async function collectQueueJobs(queue: Queue, limit: number) {
  const result: QueueJobSummary = {
    waiting: [],
    active: [],
    delayed: [],
    failed: [],
    completed: [],
  };

  await Promise.all(
    JOB_STATES.map(async (state) => {
      const jobs = await queue.getJobs(
        [state],
        0,
        Math.max(limit - 1, 0),
        false
      );
      result[state] = jobs.map((job) => serializeJob(job, state));
    })
  );

  return result;
}

function serializeJob(job: Job, status: JobState): JobPayload {
  let safeData: unknown = null;
  try {
    safeData = JSON.parse(JSON.stringify(job.data ?? null));
  } catch {
    safeData = job.data ?? null;
  }

  const numericProgress =
    typeof job.progress === "number"
      ? job.progress
      : Number.isFinite(Number(job.progress))
        ? Number(job.progress)
        : null;

  const failedReason =
    job.failedReason ??
    (Array.isArray(job.stacktrace) && job.stacktrace.length > 0
      ? job.stacktrace[0]
      : null);

  return {
    id: String(job.id),
    name: job.name,
    status,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    processedOn: job.processedOn ?? null,
    finishedOn: job.finishedOn ?? null,
    progress: numericProgress,
    failedReason,
    data: safeData,
    returnValue: job.returnvalue ?? null,
    stacktrace: Array.isArray(job.stacktrace)
      ? job.stacktrace.map((line) => String(line)).filter(Boolean)
      : [],
  };
}

function validateDto<T extends object>(cls: new () => T, payload: unknown): T {
  const instance = plainToInstance(cls, payload ?? {}, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });
  const errors = validateSync(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length) {
    throw new BadRequestException(
      errors.map((e) => Object.values(e.constraints ?? {})).flat()
    );
  }
  return instance;
}

@Controller("crawl")
export class CrawlController {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly queue: CrawlQueue
  ) {}

  @Get("sources")
  async listSources(@Query() query: Partial<ListSourceQuery>) {
    await ensureCrawlSchema(this.ds);
    const params = validateDto(ListSourceQuery, query);
    const rows = await this.ds.query(
      `
        SELECT id, name, base_url AS "baseUrl", created_at AS "createdAt"
        FROM source
        ORDER BY created_at DESC
        LIMIT $1
      `,
      [params.limit]
    );
    return { items: rows, limit: params.limit };
  }

  @Post("sources")
  async createSource(@Body() body: CreateSourceDto) {
    await ensureCrawlSchema(this.ds);
    const dto = validateDto(CreateSourceDto, body);
    const trimmedName = dto.name.trim();
    const trimmedBaseUrl = dto.baseUrl.trim();
    if (!trimmedName || !trimmedBaseUrl) {
      throw new BadRequestException("name and baseUrl cannot be empty");
    }
    const inserted = await this.ds.query(
      `
        INSERT INTO source(name, base_url)
        VALUES($1, $2)
        ON CONFLICT (base_url) DO UPDATE
          SET name = EXCLUDED.name
        RETURNING id
      `,
      [trimmedName, trimmedBaseUrl]
    );
    return { id: inserted[0]?.id as string };
  }

  @Post("series")
  async enqueueSeries(@Body() body: EnqueueSeriesDto) {
    await ensureCrawlSchema(this.ds);
    const dto = validateDto(EnqueueSeriesDto, body);

    await this.queue.seriesQueue.add(
      "series",
      {
        sourceId: dto.sourceId,
        extSeriesId: dto.extSeriesId,
        url: dto.url,
      },
      {
        jobId: `series_${dto.sourceId}_${dto.extSeriesId}`,
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    return {
      ok: true,
      jobId: `series_${dto.sourceId}_${dto.extSeriesId}`,
    };
  }

  @Post("chapters")
  async enqueueChapter(@Body() body: EnqueueChapterDto) {
    await ensureCrawlSchema(this.ds);
    const dto = validateDto(EnqueueChapterDto, body);
    await this.queue.chapterQueue.add(
      "chapter",
      {
        sourceId: dto.sourceId,
        seriesId: dto.seriesId,
        extChapterId: dto.extChapterId,
        url: dto.url,
        indexNo: dto.indexNo,
      },
      {
        jobId: `chapter_${dto.sourceId}_${dto.extChapterId}`,
        removeOnComplete: true,
        removeOnFail: true,
      }
    );
    return {
      ok: true,
      jobId: `chapter_${dto.sourceId}_${dto.extChapterId}`,
    };
  }

  @Get("jobs")
  async jobStatus(@Query() query: Partial<JobStatusQuery>) {
    await ensureCrawlSchema(this.ds);
    const params = validateDto(JobStatusQuery, query);
    const limit = Math.max(1, Math.min(params.limit, 100));

    const [series, chapter] = await Promise.all([
      collectQueueJobs(this.queue.seriesQueue, limit),
      collectQueueJobs(this.queue.chapterQueue, limit),
    ]);

    return { series, chapter, limit };
  }
}
