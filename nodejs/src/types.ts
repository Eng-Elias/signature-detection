/**
 * Type definitions for the signature detection system
 */

export interface BoundingBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    confidence: number;
    class_id: number;
    class_name: string;
}

export interface DetectionResult {
    boxes: BoundingBox[];
    inferenceTime: number;
    imageWidth: number;
    imageHeight: number;
}

export interface MetricsData {
    totalInferences: number;
    avgInferenceTime: number;
    recentTimes: number[];
    startIndex: number;
}

export interface PageData {
    pageNum: number;
    annotatedImage: Buffer;
    signatures: Array<{
        image: Buffer;
        confidence: number;
    }>;
    metrics: {
        inferenceTime: number;
        totalInferences: number;
        avgTime: number;
        times: number[];
        startIndex: number;
    };
}

export interface ProcessedPDFResult {
    pages: PageData[];
    totalPages: number;
    totalSignatures: number;
}

export interface PreprocessedImage {
    input: Float32Array;
    originalWidth: number;
    originalHeight: number;
}
