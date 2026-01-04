# Hướng dẫn Deploy lên Vercel

## Phương án 1: Deploy Backend + Frontend (Recommended)

### Setting trên Vercel Dashboard:

1. **Framework Preset**: `Other`
2. **Root Directory**: `./` (để trống hoặc chọn root)
3. **Build Command**: `npm run vercel-build`
4. **Output Directory**: (để trống)
5. **Install Command**: `npm install`

### Environment Variables cần thiết:
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: JWT secret key
- `FRONTEND_URL`: URL của frontend sau khi deploy (hoặc Vercel URL)
- Các biến môi trường khác từ `.env` của bạn

### Lưu ý:
- Backend sẽ serve frontend tĩnh từ thư mục `dist`
- Socket.IO có thể cần config thêm cho Vercel serverless
- Vercel có giới hạn 10s timeout cho serverless functions

---

## Phương án 2: Deploy Frontend riêng (Nếu muốn deploy frontend độc lập)

### Setting trên Vercel Dashboard:

1. **Framework Preset**: `Vite`
2. **Root Directory**: `admin`
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. **Install Command**: `npm install`

### Environment Variables (trong admin):
- Tạo file `.env` trong thư mục `admin` với:
  - `VITE_API_URL`: URL của backend API
  - `VITE_SOCKET_URL`: URL cho Socket.IO

### Lưu ý cho phương án này:
- Cần deploy backend riêng (ví dụ: Railway, Render, DigitalOcean)
- Hoặc sử dụng Vercel Monorepo để deploy cả 2

---

## Recommended: Phương án 1

Với cấu trúc hiện tại của bạn, **Phương án 1** phù hợp hơn vì:
- Backend đã có sẵn code serve static files
- Đơn giản hơn, chỉ cần 1 deployment
- Chi phí thấp hơn
