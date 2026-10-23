# Automotive Repair Documents MVP

MVP này độc lập với `../mobile-web/`. Từ root repository, chạy một HTTP server và mở:

```powershell
python -m http.server 4173
```

`http://localhost:4173/mvp/`

Nó dùng sample data do dự án tạo, không dùng tài liệu hoặc hình ảnh của Carmin / Auto Repair Documents. Supabase schema có tại `supabase/migrations/0001_initial_schema.sql`; không migration hoặc kết nối cloud nếu chưa cấu hình `.env.local` bởi owner.
