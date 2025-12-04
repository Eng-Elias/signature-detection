/**
 * Signature detector using YOLOv8 ONNX model
 */

import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { MetricsStorage } from './metricsStorage';
import { BoundingBox, DetectionResult, PreprocessedImage } from './types';
import { nms, xywh2xyxy, scaleCoordinates, clip } from './utils';
import { 
    MODEL_PATH, 
    MODEL_INPUT_SIZE, 
    CLASS_NAMES,
    DEFAULT_CONFIDENCE_THRESHOLD,
    DEFAULT_IOU_THRESHOLD 
} from './constants';

export class SignatureDetector {
    private session: ort.InferenceSession | null = null;
    private metricsStorage: MetricsStorage;
    private modelPath: string;

    constructor(modelPath: string = MODEL_PATH) {
        this.modelPath = modelPath;
        this.metricsStorage = new MetricsStorage();
    }

    /**
     * Load the ONNX model
     */
    async loadModel(): Promise<void> {
        if (!this.session) {
            this.session = await ort.InferenceSession.create(this.modelPath, {
                executionProviders: ['cpu']
            });
            console.log('✓ Model loaded successfully');
        }
    }

    /**
     * Preprocess image for model input
     */
    async preprocessImage(imageBuffer: Buffer): Promise<PreprocessedImage> {
        const img = sharp(imageBuffer);
        const metadata = await img.metadata();
        const originalWidth = metadata.width!;
        const originalHeight = metadata.height!;

        // Resize to 640x640 and convert to RGB
        const pixels = await img
            .removeAlpha()
            .resize(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, { fit: 'fill' })
            .raw()
            .toBuffer();

        // Split into R, G, B channels and normalize
        const red: number[] = [];
        const green: number[] = [];
        const blue: number[] = [];

        for (let i = 0; i < pixels.length; i += 3) {
            red.push(pixels[i] / 255.0);
            green.push(pixels[i + 1] / 255.0);
            blue.push(pixels[i + 2] / 255.0);
        }

        // Concatenate channels: [R, G, B]
        const input = Float32Array.from([...red, ...green, ...blue]);

        return {
            input,
            originalWidth,
            originalHeight
        };
    }

    /**
     * Run inference on preprocessed input
     */
    private async runInference(input: Float32Array): Promise<Float32Array> {
        if (!this.session) {
            throw new Error('Model not loaded. Call loadModel() first.');
        }

        const tensor = new ort.Tensor('float32', input, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
        const feeds = { images: tensor };
        const outputs = await this.session.run(feeds);
        
        return outputs.output0.data as Float32Array;
    }

    /**
     * Process model output to extract bounding boxes
     */
    private processOutput(
        output: Float32Array,
        originalWidth: number,
        originalHeight: number,
        confThreshold: number,
        iouThreshold: number
    ): BoundingBox[] {
        const boxes: BoundingBox[] = [];
        const numClasses = 1; // Only signature class
        const numDetections = 8400;

        // Output shape is [1, 84, 8400] flattened
        // Each detection: [x, y, w, h, conf_class0, conf_class1, ...]
        for (let i = 0; i < numDetections; i++) {
            // Get confidence for signature class (index 4)
            const confidence = output[4 * numDetections + i];

            if (confidence >= confThreshold) {
                // Get box coordinates
                const x = output[0 * numDetections + i];
                const y = output[1 * numDetections + i];
                const w = output[2 * numDetections + i];
                const h = output[3 * numDetections + i];

                // Convert from xywh to xyxy
                const [x1, y1, x2, y2] = xywh2xyxy(x, y, w, h);

                // Scale to original image size
                const [sx1, sy1, sx2, sy2] = scaleCoordinates(
                    [x1, y1, x2, y2],
                    originalWidth,
                    originalHeight,
                    MODEL_INPUT_SIZE
                );

                boxes.push({
                    x1: clip(sx1, 0, originalWidth),
                    y1: clip(sy1, 0, originalHeight),
                    x2: clip(sx2, 0, originalWidth),
                    y2: clip(sy2, 0, originalHeight),
                    confidence,
                    class_id: 0,
                    class_name: CLASS_NAMES[0]
                });
            }
        }

        // Apply Non-Maximum Suppression
        return nms(boxes, iouThreshold);
    }

    /**
     * Draw bounding boxes on image
     */
    async drawBoxes(imageBuffer: Buffer, boxes: BoundingBox[]): Promise<Buffer> {
        // Convert to PNG first to avoid JPEG canvas issues
        const pngBuffer = await sharp(imageBuffer).png().toBuffer();
        
        const img = await loadImage(pngBuffer);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Draw bounding boxes
        boxes.forEach(box => {
            const width = box.x2 - box.x1;
            const height = box.y2 - box.y1;

            // Draw rectangle
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x1, box.y1, width, height);

            // Draw label
            const label = `${box.class_name}: ${(box.confidence * 100).toFixed(1)}%`;
            ctx.font = 'bold 16px Arial';
            const textMetrics = ctx.measureText(label);
            const textHeight = 20;

            // Draw label background
            ctx.fillStyle = '#00FF00';
            ctx.fillRect(box.x1, box.y1 - textHeight - 5, textMetrics.width + 10, textHeight + 5);

            // Draw label text
            ctx.fillStyle = '#000000';
            ctx.fillText(label, box.x1 + 5, box.y1 - 8);
        });

        return canvas.toBuffer('image/png');
    }

    /**
     * Main detection method
     */
    async detect(
        imageBuffer: Buffer,
        confThreshold: number = DEFAULT_CONFIDENCE_THRESHOLD,
        iouThreshold: number = DEFAULT_IOU_THRESHOLD
    ): Promise<DetectionResult> {
        await this.loadModel();

        const startTime = Date.now();

        // Preprocess
        const { input, originalWidth, originalHeight } = await this.preprocessImage(imageBuffer);

        // Run inference
        const output = await this.runInference(input);

        // Post-process
        const boxes = this.processOutput(
            output,
            originalWidth,
            originalHeight,
            confThreshold,
            iouThreshold
        );

        const inferenceTime = Date.now() - startTime;

        // Store metrics
        this.metricsStorage.addMetric(inferenceTime);

        return {
            boxes,
            inferenceTime,
            imageWidth: originalWidth,
            imageHeight: originalHeight
        };
    }

    /**
     * Get metrics storage instance
     */
    getMetricsStorage(): MetricsStorage {
        return this.metricsStorage;
    }

    /**
     * Clean up resources
     */
    cleanup(): void {
        this.metricsStorage.close();
    }
}
