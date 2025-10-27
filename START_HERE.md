# 🚀 QIC Life - Quick Start Guide

## ✅ SERVERS ARE NOW CONNECTED!

Both your frontend and backend are running and properly connected.

### 📡 Server Status

**Frontend (Vite/React)**
- URL: http://localhost:8080/
- Status: ✅ Running
- Tech: React + TypeScript + Vite

**Backend (Express API)**
- URL: http://localhost:3001/
- Status: ✅ Running  
- Tech: Node.js + Express

### 🔗 Connection Details

The frontend automatically connects to the backend at:
```
http://localhost:3001/api
```

CORS is configured to allow requests from:
- http://localhost:8080 (current frontend)
- http://localhost:8081 (alternate port)
- http://localhost:5173 (default Vite port)

## 🎯 How to Use

### Start Both Servers (Recommended)
```bash
npm run dev:all
```
This starts BOTH frontend and backend together using `concurrently`.

### Start Servers Separately

**Frontend only:**
```bash
npm run dev
```

**Backend only:**
```bash
npm run backend:dev
# OR
cd backend
npm run dev
```

## 📁 Project Structure

```
qiclife/
├── src/              # Frontend React code
│   ├── pages/        # Page components
│   ├── lib/          # API client (connects to backend)
│   └── components/   # Reusable components
│
├── backend/          # Backend Express API
│   ├── routes/       # API endpoints
│   ├── services/     # Business logic
│   ├── middleware/   # CORS, auth, etc.
│   └── .env         # Backend config (NEW!)
│
└── .env             # Frontend config
```

## 🔧 What Was Fixed

1. ✅ Created `backend/.env` file with proper configuration
2. ✅ Fixed CORS to allow multiple frontend origins
3. ✅ Updated frontend API client to use correct env variable (`VITE_API_URL`)
4. ✅ Configured backend to accept requests from all localhost ports
5. ✅ Set up `npm run dev:all` to run both servers together

## 🧪 Test the Connection

1. Open your browser to: http://localhost:8080/
2. Click on "Health" in the navigation
3. You should see backend status showing as "OK"

## 📝 Environment Variables

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001/api
```

### Backend (backend/.env)
```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:8080,http://localhost:8081,http://localhost:5173
```

## ⚠️ Important Notes

- Both servers must be running for the app to work
- Frontend is on port **8080**
- Backend is on port **3001**
- The backend `.env` file was just created - update Supabase credentials if needed

## 🐛 Troubleshooting

**"Connection Error" on frontend?**
- Make sure backend is running on port 3001
- Check `npm run dev:all` is running both servers

**CORS errors in console?**
- Backend automatically allows localhost:8080
- Check backend/.env CORS_ORIGIN setting

**Port already in use?**
- Frontend will auto-switch to port 8081
- Backend needs port 3001 free

## 🎉 You're All Set!

Your frontend and backend are now properly connected. No more separate folders confusion!

Visit: http://localhost:8080/
