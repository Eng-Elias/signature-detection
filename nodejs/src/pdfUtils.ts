/**
 * PDF processing utilities using pdfjs-dist
 */

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { createCanvas } from 'canvas';
import { DEFAULT_PDF_SCALE } from './constants';

// NodeJS Canvas factory for pdfjs
class NodeCanvasFactory {
    create(width: number, height: number) {
        const canvas = createCanvas(width, height);
        return {
            canvas,
            context: canvas.getContext('2d')
        };
    }

    reset(canvasAndContext: any, width: number, height: number) {
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
    }

    destroy(canvasAndContext: any) {
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
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
     * Convert PDF pages to images
     */
    async pdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(pdfBuffer),
            useSystemFonts: true
        });

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
        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(pdfBuffer),
            useSystemFonts: true
        });

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
            viewport.width,
            viewport.height
        );

        const renderContext = {
            canvasContext: canvasAndContext.context,
            viewport: viewport,
            canvasFactory: canvasFactory
        };

        await page.render(renderContext).promise;

        // Convert canvas to buffer
        const buffer = canvasAndContext.canvas.toBuffer('image/png');

        // Clean up
        canvasFactory.destroy(canvasAndContext);

        return buffer;
    }

    /**
     * Get page count from PDF
     */
    async getPageCount(pdfBuffer: Buffer): Promise<number> {
        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(pdfBuffer),
            useSystemFonts: true
        });

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
        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(pdfBuffer),
            useSystemFonts: true
        });

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
