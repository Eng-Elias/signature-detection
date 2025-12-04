/**
 * Signature cropping utilities
 */

import sharp from 'sharp';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { BoundingBox } from './types';
import { DEFAULT_SIGNATURE_PADDING } from './constants';

export class SignatureCropper {
    private padding: number;

    constructor(padding: number = DEFAULT_SIGNATURE_PADDING) {
        this.padding = padding;
    }

    /**
     * Crop a single signature from image
     */
    async cropSignature(
        imageBuffer: Buffer,
        box: BoundingBox
    ): Promise<Buffer> {
        const img = sharp(imageBuffer);
        const metadata = await img.metadata();
        const imgWidth = metadata.width!;
        const imgHeight = metadata.height!;

        // Add padding
        const x1 = Math.max(0, Math.floor(box.x1 - this.padding));
        const y1 = Math.max(0, Math.floor(box.y1 - this.padding));
        const x2 = Math.min(imgWidth, Math.ceil(box.x2 + this.padding));
        const y2 = Math.min(imgHeight, Math.ceil(box.y2 + this.padding));

        const width = x2 - x1;
        const height = y2 - y1;

        // Crop the region
        const cropped = await img
            .extract({
                left: x1,
                top: y1,
                width,
                height
            })
            .png()
            .toBuffer();

        return cropped;
    }

    /**
     * Crop all signatures from image
     */
    async cropSignatures(
        imageBuffer: Buffer,
        boxes: BoundingBox[]
    ): Promise<Array<{ image: Buffer; confidence: number }>> {
        const signatures: Array<{ image: Buffer; confidence: number }> = [];

        for (const box of boxes) {
            const cropped = await this.cropSignature(imageBuffer, box);
            signatures.push({
                image: cropped,
                confidence: box.confidence
            });
        }

        return signatures;
    }

    /**
     * Create a grid of cropped signatures
     */
    async createSignatureGrid(
        signatures: Array<{ image: Buffer; confidence: number }>,
        columns: number = 3,
        cellSize: number = 200
    ): Promise<Buffer> {
        if (signatures.length === 0) {
            // Return empty placeholder
            const canvas = createCanvas(cellSize, cellSize);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#F3F4F6';
            ctx.fillRect(0, 0, cellSize, cellSize);
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No signatures', cellSize / 2, cellSize / 2);
            return canvas.toBuffer('image/png');
        }

        const rows = Math.ceil(signatures.length / columns);
        const canvasWidth = columns * cellSize;
        const canvasHeight = rows * cellSize;

        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');

        // Fill background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Draw signatures
        for (let i = 0; i < signatures.length; i++) {
            const row = Math.floor(i / columns);
            const col = i % columns;
            const x = col * cellSize;
            const y = row * cellSize;

            const sig = signatures[i];
            const img = await loadImage(sig.image);

            // Calculate scaling to fit in cell
            const scale = Math.min(
                (cellSize - 20) / img.width,
                (cellSize - 40) / img.height
            );
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;

            // Center in cell
            const offsetX = x + (cellSize - scaledWidth) / 2;
            const offsetY = y + (cellSize - scaledHeight - 20) / 2;

            // Draw image
            ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

            // Draw confidence
            ctx.fillStyle = '#6B7280';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(
                `${(sig.confidence * 100).toFixed(1)}%`,
                x + cellSize / 2,
                y + cellSize - 10
            );

            // Draw border
            ctx.strokeStyle = '#E5E7EB';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, cellSize, cellSize);
        }

        return canvas.toBuffer('image/png');
    }

    /**
     * Set padding
     */
    setPadding(padding: number): void {
        this.padding = padding;
    }

    /**
     * Get current padding
     */
    getPadding(): number {
        return this.padding;
    }
}
