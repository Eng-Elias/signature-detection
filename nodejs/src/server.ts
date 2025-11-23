/**
 * Express server for signature detection
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import dotenv from 'dotenv';
import { SignatureDetector } from './detector';
import { PDFProcessor } from './pdfUtils';
import { SignatureCropper } from './signatureCropper';
import { PageData } from './types';
import { DEFAULT_PORT, MAX_FILE_SIZE, UPLOAD_DIR } from './constants';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize components
const detector = new SignatureDetector();
const pdfProcessor = new PDFProcessor();
const signatureCropper = new SignatureCropper();

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Root endpoint - serve HTML
 */
app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

/**
 * Process single file (image or single-page PDF)
 */
app.post('/api/process-single', upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const confThreshold = parseFloat(req.body.conf_threshold || '0.25');
        const iouThreshold = parseFloat(req.body.iou_threshold || '0.5');

        let imageBuffer = req.file.buffer;

        // Check if PDF
        if (pdfProcessor.isPDF(req.file.buffer)) {
            // Extract first page
            const images = await pdfProcessor.pdfToImages(req.file.buffer);
            imageBuffer = images[0];
        }

        // Detect signatures
        const result = await detector.detect(imageBuffer, confThreshold, iouThreshold);

        // Draw bounding boxes
        const annotatedImage = await detector.drawBoxes(imageBuffer, result.boxes);

        // Crop signatures
        const signatures = await signatureCropper.cropSignatures(imageBuffer, result.boxes);

        // Get metrics
        const metrics = detector.getMetricsStorage().getAllMetrics();

        res.json({
            success: true,
            annotatedImage: annotatedImage.toString('base64'),
            signatures: signatures.map(sig => ({
                image: sig.image.toString('base64'),
                confidence: sig.confidence
            })),
            boxes: result.boxes,
            metrics: {
                inferenceTime: result.inferenceTime,
                totalInferences: metrics.totalInferences,
                avgTime: metrics.avgInferenceTime,
                times: metrics.recentTimes
            }
        });

    } catch (error: any) {
        console.error('Error processing file:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Process multi-page PDF
 */
app.post('/api/process-pdf', upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        if (!pdfProcessor.isPDF(req.file.buffer)) {
            return res.status(400).json({ error: 'File is not a PDF' });
        }

        const confThreshold = parseFloat(req.body.conf_threshold || '0.25');
        const iouThreshold = parseFloat(req.body.iou_threshold || '0.5');

        // Convert PDF to images
        const images = await pdfProcessor.pdfToImages(req.file.buffer);
        const pages: PageData[] = [];

        // Process each page
        for (let i = 0; i < images.length; i++) {
            const imageBuffer = images[i];

            // Detect signatures
            const result = await detector.detect(imageBuffer, confThreshold, iouThreshold);

            // Draw bounding boxes
            const annotatedImage = await detector.drawBoxes(imageBuffer, result.boxes);

            // Crop signatures
            const signatures = await signatureCropper.cropSignatures(imageBuffer, result.boxes);

            // Get metrics
            const metrics = detector.getMetricsStorage().getAllMetrics();

            pages.push({
                pageNum: i + 1,
                annotatedImage,
                signatures,
                metrics: {
                    inferenceTime: result.inferenceTime,
                    totalInferences: metrics.totalInferences,
                    avgTime: metrics.avgInferenceTime,
                    times: metrics.recentTimes,
                    startIndex: metrics.startIndex
                }
            });
        }

        // Calculate total signatures
        const totalSignatures = pages.reduce((sum, page) => sum + page.signatures.length, 0);

        res.json({
            success: true,
            pages: pages.map(page => ({
                pageNum: page.pageNum,
                annotatedImage: page.annotatedImage.toString('base64'),
                signatures: page.signatures.map(sig => ({
                    image: sig.image.toString('base64'),
                    confidence: sig.confidence
                })),
                metrics: page.metrics
            })),
            totalPages: pages.length,
            totalSignatures
        });

    } catch (error: any) {
        console.error('Error processing PDF:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get metrics
 */
app.get('/api/metrics', (req: Request, res: Response) => {
    try {
        const metrics = detector.getMetricsStorage().getAllMetrics();
        res.json(metrics);
    } catch (error: any) {
        console.error('Error getting metrics:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Health check
 */
app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Start server
 */
const PORT = process.env.PORT || DEFAULT_PORT;

async function startServer() {
    try {
        // Load model on startup
        console.log('Loading ONNX model...');
        await detector.loadModel();
        console.log('✓ Model loaded successfully');

        app.listen(PORT, () => {
            console.log(`\n🚀 Signature Detection Server running on http://localhost:${PORT}`);
            console.log(`📊 Open your browser and navigate to http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await detector.cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nShutting down gracefully...');
    await detector.cleanup();
    process.exit(0);
});

// Start the server
startServer();
