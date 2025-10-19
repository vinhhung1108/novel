# NovelSite Monorepo — Step 1 (Scaffold)


## Yêu cầu
- Node 20+
- pnpm 9+ (khuyên dùng)
- Docker & Docker Compose


## Cách chạy
```bash
cp .env.example .env
pnpm i
docker compose -f infra/docker-compose.yml up -d
pnpm dev
```


- Web: http://localhost:3000 (ping API health)
- Admin: http://localhost:3001
- API health: http://localhost:4000/health
- MinIO console: http://localhost:9001 (user/pass: minio / minio123)


## Tiếp theo (Step 2)
- Kết nối Nest với Postgres (TypeORM) + migration nền tảng (users, roles,…)
- Thêm CORS, helmet, config module.
- Chuẩn hoá ESLint/Prettier toàn repo.


---
Tips giảm lỗi: chạy từng lệnh theo thứ tự, nếu có lỗi hãy copy log để mình xử lý ngay.