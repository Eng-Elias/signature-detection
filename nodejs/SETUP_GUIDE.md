# 🚀 Setup Guide - Node.js Signature Detection

Complete step-by-step guide to get the Node.js/TypeScript signature detection system running.

---

## 📋 Prerequisites

### Required Software

1. **Node.js** (version 18.0.0 or higher)
   - Download: https://nodejs.org/
   - Verify installation:
     ```bash
     node --version
     npm --version
     ```

2. **Git** (for cloning the repository)
   - Download: https://git-scm.com/

3. **Build Tools** (for native dependencies)

   **Windows:**
   ```bash
   npm install --global windows-build-tools
   ```

   **macOS:**
   ```bash
   xcode-select --install
   brew install pkg-config cairo pango libpng jpeg giflib librsvg
   ```

   **Linux (Ubuntu/Debian):**
   ```bash
   sudo apt-get update
   sudo apt-get install build-essential libcairo2-dev libpango1.0-dev \
                        libjpeg-dev libgif-dev librsvg2-dev
   ```

---

## 📦 Installation

### Step 1: Navigate to Project Directory

```bash
cd signature-detection/nodejs
```

### Step 2: Install Node.js Dependencies

```bash
npm install
```

This will install all required packages:
- onnxruntime-node
- express
- multer
- sharp
- pdf-lib
- canvas
- better-sqlite3
- typescript
- And all other dependencies

**Note:** Installation might take 3-5 minutes due to native modules (canvas, sharp, better-sqlite3).

### Step 3: Copy the ONNX Model

The ONNX model should be located in the parent directory's `model/` folder.

```bash
# Create model directory
mkdir model

# Copy model from parent directory
# Windows (PowerShell)
copy ..\model\model.onnx .\model\

# Linux/macOS
cp ../model/model.onnx ./model/
```

### Step 4: Create Environment File (Optional)

```bash
# Windows
copy .env.example .env

# Linux/macOS
cp .env.example .env
```

Edit `.env` if you need to change the default port or paths:
```env
PORT=3000
MODEL_PATH=./model/model.onnx
DATABASE_PATH=./db/metrics.db
```

---

## 🏗️ Building the Project

### Compile TypeScript

```bash
npm run build
```

This compiles all TypeScript files in `src/` to JavaScript in `dist/`.

**Expected output:**
```
✓ Compiled successfully
```

---

## ▶️ Running the Application

### Option 1: Development Mode (Recommended for testing)

Runs with `ts-node` for instant TypeScript execution:

```bash
npm run dev
```

### Option 2: Production Mode

Compile first, then run:

```bash
npm run build
npm start
```

### Expected Output

```
Loading ONNX model...
✓ Model loaded successfully

🚀 Signature Detection Server running on http://localhost:3000
📊 Open your browser and navigate to http://localhost:3000
```

---

## 🌐 Accessing the Application

1. **Open your web browser**

2. **Navigate to:**
   ```
   http://localhost:3000
   ```

3. **You should see the signature detection interface**

---

## ✅ Verification

### Test the Installation

1. **Click on "Single Page" tab**
2. **Upload a test image** (JPG or PNG)
3. **Click "Detect Signatures"**
4. **You should see:**
   - Annotated image with bounding boxes
   - Extracted signatures (if any detected)
   - Performance metrics

### API Health Check

Open a new terminal and run:

```bash
# Windows
curl http://localhost:3000/api/health

# Linux/macOS
curl http://localhost:3000/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## 🔧 Troubleshooting

### Issue 1: Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**
Change the port in `.env`:
```env
PORT=3001
```

Or stop the process using port 3000:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/macOS
lsof -i :3000
kill -9 <PID>
```

### Issue 2: Model Not Found

**Error:**
```
Error: ENOENT: no such file or directory, open './model/model.onnx'
```

**Solution:**
Ensure the model file exists:
```bash
# Check if model exists
ls model/model.onnx  # Linux/macOS
dir model\model.onnx  # Windows

# If not, copy it
mkdir model
cp ../model/model.onnx ./model/  # Linux/macOS
copy ..\model\model.onnx .\model\  # Windows
```

### Issue 3: Canvas Installation Fails

**Error:**
```
Error: Could not install canvas
```

**Solution:**

**Windows:**
```bash
npm install --global windows-build-tools
npm install canvas
```

**macOS:**
```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
npm install canvas
```

**Linux:**
```bash
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev \
                     libjpeg-dev libgif-dev librsvg2-dev
npm install canvas
```

### Issue 4: TypeScript Compilation Errors

**Error:**
```
error TS2307: Cannot find module 'express'
```

**Solution:**
Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json  # Linux/macOS
rmdir /s node_modules & del package-lock.json  # Windows

npm install
```

### Issue 5: SQLite Errors

**Error:**
```
Error: SQLITE_ERROR: unable to open database file
```

**Solution:**
The database directory will be created automatically. If issues persist:
```bash
rm -rf db/  # Linux/macOS
rmdir /s db  # Windows

# Restart the application
npm start
```

### Issue 6: ONNX Runtime Errors

**Error:**
```
Error: Cannot find module 'onnxruntime-node'
```

**Solution:**
```bash
npm install onnxruntime-node@latest
```

### Issue 7: Memory Issues

**Error:**
```
FATAL ERROR: JavaScript heap out of memory
```

**Solution:**
Increase Node.js memory limit:
```bash
# Linux/macOS
export NODE_OPTIONS="--max-old-space-size=4096"
npm start

# Windows
set NODE_OPTIONS=--max-old-space-size=4096
npm start
```

---

## 📊 Project Structure After Setup

```
nodejs/
├── src/                      # TypeScript source
├── dist/                     # Compiled JavaScript ✓
├── public/                   # Frontend files
├── model/                    # ONNX model ✓
│   └── model.onnx
├── db/                       # SQLite database ✓ (created on first run)
│   └── metrics.db
├── node_modules/             # Dependencies ✓
├── package.json
├── tsconfig.json
├── .env                      # Configuration ✓
└── README.md
```

---

## 🎯 Next Steps

1. **Test with sample images**
   - Try different image formats (JPG, PNG)
   - Test with PDFs (single and multi-page)

2. **Adjust detection thresholds**
   - Lower confidence for more detections
   - Higher confidence for fewer, more accurate detections

3. **Review the API**
   - Check `/api/metrics` for performance data
   - Test API endpoints with Postman or curl

4. **Explore the code**
   - Review `src/detector.ts` for detection logic
   - Check `src/server.ts` for API endpoints
   - Examine `public/app.js` for frontend logic

---

## 📝 Development Workflow

### Making Changes

1. **Edit TypeScript files** in `src/`

2. **In development mode:**
   ```bash
   npm run dev
   ```
   Changes require restart

3. **In watch mode:**
   ```bash
   # Terminal 1: Watch and compile
   npm run watch

   # Terminal 2: Run server (restart on changes)
   npm start
   ```

### Testing

1. **Compile:**
   ```bash
   npm run build
   ```

2. **Run:**
   ```bash
   npm start
   ```

3. **Test in browser:**
   - Upload files
   - Check console for errors
   - Review network tab for API calls

---

## 🔒 Security Notes

- Never commit `.env` file with sensitive data
- Keep `HF_TOKEN` secret if using private models
- Use environment variables for production
- Implement authentication for production deployments

---

## 📚 Additional Resources

- **ONNX Runtime Docs:** https://onnxruntime.ai/docs/get-started/with-javascript.html
- **Express.js Docs:** https://expressjs.com/
- **TypeScript Docs:** https://www.typescriptlang.org/docs/
- **Sharp Docs:** https://sharp.pixelplumbing.com/
- **Canvas Docs:** https://github.com/Automattic/node-canvas

---

## 🆘 Getting Help

If you encounter issues not covered here:

1. **Check the README.md** for detailed feature documentation
2. **Review TypeScript compilation errors** - they often point to the issue
3. **Check browser console** for frontend errors
4. **Review server logs** for backend errors
5. **Verify all dependencies** are installed correctly

---

## ✅ Installation Checklist

- [ ] Node.js 18+ installed
- [ ] Build tools installed (platform-specific)
- [ ] Project directory navigated to
- [ ] `npm install` completed successfully
- [ ] ONNX model copied to `./model/`
- [ ] `.env` file created (optional)
- [ ] TypeScript compiled (`npm run build`)
- [ ] Server starts without errors
- [ ] Browser can access `http://localhost:3000`
- [ ] Health check returns OK status
- [ ] Test image processes successfully

---

**Setup complete! Ready to detect signatures!** 🎉

For usage instructions, see [README.md](README.md)
