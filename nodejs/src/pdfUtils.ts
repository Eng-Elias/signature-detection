/**
 * PDF processing utilities using pdfjs-dist v5.x with @napi-rs/canvas
 */

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { DEFAULT_PDF_SCALE } from './constants';

// NodeJS Canvas factory for pdfjs-dist v5.x using @napi-rs/canvas
class NodeCanvasFactory {
    create(width: number, height: number) {
        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');
        return { canvas, context };
    }

    reset(canvasAndContext: any, width: number, height: number) {
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
    }

    destroy(canvasAndContext: any) {
        canvasAndContext.canvas = null;
        canvasAndContext.context = null;
    }
}

export class PDFProcessor {
    private scale: number;

    constructor(scale: number = DEFAULT_PDF_SCALE) {
        this.scale = scale;
    }

    /**
     * Check if file is a PDF
     */
    isPDF(buffer: Buffer): boolean {
        // Check PDF magic number
        return buffer[0] === 0x25 && 
               buffer[1] === 0x50 && 
               buffer[2] === 0x44 && 
               buffer[3] === 0x46;
    }

    /**
     * Create document loading options for pdfjs
     */
    private getDocumentOptions(pdfBuffer: Buffer) {
        return {
            data: new Uint8Array(pdfBuffer),
            useSystemFonts: true,
            // Disable features that cause issues in Node.js
            isEvalSupported: false,
            isOffscreenCanvasSupported: false,
            // Use canvas factory for all operations
            canvasFactory: new NodeCanvasFactory()
        };
    }

    /**
     * Convert PDF pages to images
     */
    async pdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
        const loadingTask = pdfjsLib.getDocument(this.getDocumentOptions(pdfBuffer));

        const pdfDoc = await loadingTask.promise;
        const pageCount = pdfDoc.numPages;
        const images: Buffer[] = [];

        for (let i = 1; i <= pageCount; i++) {
            const image = await this.renderPage(pdfDoc, i);
            images.push(image);
        }

        return images;
    }

    /**
     * Extract a specific page from PDF as image
     */
    async extractPage(pdfBuffer: Buffer, pageIndex: number): Promise<Buffer> {
        const loadingTask = pdfjsLib.getDocument(this.getDocumentOptions(pdfBuffer));

        const pdfDoc = await loadingTask.promise;
        
        if (pageIndex >= pdfDoc.numPages) {
            throw new Error(`Page index ${pageIndex} out of range. PDF has ${pdfDoc.numPages} pages.`);
        }

        // pdfjs uses 1-based page numbering
        return await this.renderPage(pdfDoc, pageIndex + 1);
    }

    /**
     * Render a PDF page to image buffer
     */
    private async renderPage(pdfDoc: any, pageNumber: number): Promise<Buffer> {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: this.scale });

        const canvasFactory = new NodeCanvasFactory();
        const canvasAndContext = canvasFactory.create(
            Math.floor(viewport.width),
            Math.floor(viewport.height)
        );

        const renderContext = {
            canvasContext: canvasAndContext.context,
            viewport: viewport,
            canvasFactory: canvasFactory,
            background: 'white'
        };

        // Render the PDF page to canvas
        await page.render(renderContext).promise;

        // Convert canvas to PNG buffer
        const buffer = Buffer.from(canvasAndContext.canvas.toBuffer('image/png'));

        // Clean up
        canvasFactory.destroy(canvasAndContext);
        page.cleanup();

        return buffer;
    }

    /**
     * Get page count from PDF
     */
    async getPageCount(pdfBuffer: Buffer): Promise<number> {
        const loadingTask = pdfjsLib.getDocument(this.getDocumentOptions(pdfBuffer));
        const pdfDoc = await loadingTask.promise;
        return pdfDoc.numPages;
    }

    /**
     * Get PDF metadata
     */
    async getMetadata(pdfBuffer: Buffer): Promise<{
        pageCount: number;
        title?: string;
        author?: string;
        subject?: string;
    }> {
        const loadingTask = pdfjsLib.getDocument(this.getDocumentOptions(pdfBuffer));
        const pdfDoc = await loadingTask.promise;
        const metadata: any = await pdfDoc.getMetadata();
        
        return {
            pageCount: pdfDoc.numPages,
            title: metadata?.info?.Title,
            author: metadata?.info?.Author,
            subject: metadata?.info?.Subject
        };
    }
}
