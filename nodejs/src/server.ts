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
import { LLMDetector } from './llmDetector';
import { PDFProcessor } from './pdfUtils';
import { SignatureCropper } from './signatureCropper';
import { PageData, DetectionResult, BoundingBox } from './types';
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
const yoloDetector = new SignatureDetector();
const pdfProcessor = new PDFProcessor();
const signatureCropper = new SignatureCropper();

// Initialize LLM detector if HF_TOKEN is available
let llmDetector: LLMDetector | null = null;
const HF_TOKEN = process.env.HF_TOKEN;

if (HF_TOKEN) {
    llmDetector = new LLMDetector({
        hfToken: HF_TOKEN,
        model: process.env.LLM_MODEL || 'Qwen/Qwen2.5-VL-72B-Instruct'
    });
    console.log('✓ LLM detector initialized with HuggingFace token');
} else {
    console.log('⚠ HF_TOKEN not set - LLM detection will not be available');
}

// Detection method type
type DetectionMethod = 'yolov8' | 'llm';

// Helper function to detect signatures based on method
async function detectSignatures(
    imageBuffer: Buffer,
    method: DetectionMethod,
    confThreshold: number,
    iouThreshold: number
): Promise<DetectionResult> {
    if (method === 'llm') {
        if (!llmDetector) {
            throw new Error('LLM detection not available. Set HF_TOKEN environment variable.');
        }
        return await llmDetector.detect(imageBuffer);
    } else {
        return await yoloDetector.detect(imageBuffer, confThreshold, iouThreshold);
    }
}

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
        const detectionMethod = (req.body.detection_method || 'yolov8') as DetectionMethod;

        let imageBuffer = req.file.buffer;

        // Check if PDF
        if (pdfProcessor.isPDF(req.file.buffer)) {
            // Extract first page
            const images = await pdfProcessor.pdfToImages(req.file.buffer);
            imageBuffer = images[0];
        }

        // Detect signatures using selected method
        const result = await detectSignatures(imageBuffer, detectionMethod, confThreshold, iouThreshold);

        // Draw bounding boxes
        const annotatedImage = await yoloDetector.drawBoxes(imageBuffer, result.boxes);

        // Crop signatures
        const signatures = await signatureCropper.cropSignatures(imageBuffer, result.boxes);

        // Get metrics (only for YOLOv8)
        const metrics = yoloDetector.getMetricsStorage().getAllMetrics();

        res.json({
            success: true,
            annotatedImage: annotatedImage.toString('base64'),
            signatures: signatures.map(sig => ({
                image: sig.image.toString('base64'),
                confidence: sig.confidence
            })),
            boxes: result.boxes,
            detectionMethod,
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
        const detectionMethod = (req.body.detection_method || 'yolov8') as DetectionMethod;

        // Convert PDF to images
        const images = await pdfProcessor.pdfToImages(req.file.buffer);
        const pages: PageData[] = [];

        // Process each page
        for (let i = 0; i < images.length; i++) {
            const imageBuffer = images[i];

            // Detect signatures using selected method
            const result = await detectSignatures(imageBuffer, detectionMethod, confThreshold, iouThreshold);

            // Draw bounding boxes
            const annotatedImage = await yoloDetector.drawBoxes(imageBuffer, result.boxes);

            // Crop signatures
            const signatures = await signatureCropper.cropSignatures(imageBuffer, result.boxes);

            // Get metrics
            const metrics = yoloDetector.getMetricsStorage().getAllMetrics();

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
            totalSignatures,
            detectionMethod
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
        const metrics = yoloDetector.getMetricsStorage().getAllMetrics();
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
 * Get available detection methods
 */
app.get('/api/detection-methods', (req: Request, res: Response) => {
    res.json({
        methods: [
            {
                id: 'yolov8',
                name: 'YOLOv8s (Local)',
                description: 'Fast local detection using YOLOv8s ONNX model',
                available: true
            },
            {
                id: 'llm',
                name: 'Qwen2.5-VL (LLM)',
                description: 'LLM-based detection via HuggingFace API',
                available: llmDetector !== null
            }
        ],
        llmModel: llmDetector ? process.env.LLM_MODEL || 'Qwen/Qwen2.5-VL-72B-Instruct' : null
    });
});

/**
 * Start server
 */
const PORT = process.env.PORT || DEFAULT_PORT;

async function startServer() {
    try {
        // Load model on startup
        console.log('Loading ONNX model...');
        await yoloDetector.loadModel();
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
    await yoloDetector.cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nShutting down gracefully...');
    await yoloDetector.cleanup();
    process.exit(0);
});

// Start the server
startServer();
