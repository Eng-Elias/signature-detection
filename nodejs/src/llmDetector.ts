/**
 * LLM-based signature detector using Qwen2.5-VL via HuggingFace Inference API
 */

import { HfInference } from '@huggingface/inference';
import sharp from 'sharp';
import { BoundingBox, DetectionResult } from './types';
import { clip } from './utils';

// Default model
const DEFAULT_MODEL = 'Qwen/Qwen2.5-VL-72B-Instruct';

// Prompt for signature detection
const SIGNATURE_DETECTION_PROMPT = `You are a precise signature detection system. Analyze the provided image and detect ALL handwritten signatures present.

For EACH signature found, provide its bounding box coordinates as percentages (0.0 to 1.0) of the image dimensions:
- x1, y1: top-left corner (as fraction of image width/height)
- x2, y2: bottom-right corner (as fraction of image width/height)
- confidence: your confidence in this detection (0.0 to 1.0)

IMPORTANT:
- Coordinates must be normalized (0.0 to 1.0), NOT pixel values
- x1 < x2 and y1 < y2 always
- Only detect handwritten signatures, NOT printed text or stamps
- Be precise with bounding boxes - include the full signature but minimize extra space

Return ONLY valid JSON in this exact format, no other text:
{
  "signatures": [
    {"x1": 0.1, "y1": 0.2, "x2": 0.3, "y2": 0.25, "confidence": 0.95},
    {"x1": 0.5, "y1": 0.7, "x2": 0.8, "y2": 0.85, "confidence": 0.88}
  ]
}

If no signatures are found, return: {"signatures": []}`;

export interface LLMDetectorOptions {
    hfToken: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
}

export class LLMDetector {
    private hf: HfInference;
    private model: string;
    private maxTokens: number;
    private temperature: number;

    constructor(options: LLMDetectorOptions) {
        if (!options.hfToken) {
            throw new Error('HuggingFace token is required for LLM detector');
        }
        
        this.hf = new HfInference(options.hfToken);
        this.model = options.model || DEFAULT_MODEL;
        this.maxTokens = options.maxTokens || 500;
        this.temperature = options.temperature || 0.1;
    }

    /**
     * Convert image buffer to base64 data URL
     */
    private async imageToBase64Url(imageBuffer: Buffer): Promise<string> {
        // Ensure image is in a supported format (JPEG or PNG)
        const metadata = await sharp(imageBuffer).metadata();
        let format = metadata.format;
        
        // Convert to JPEG if not already JPEG or PNG
        let processedBuffer: Buffer;
        if (format === 'jpeg' || format === 'jpg') {
            processedBuffer = imageBuffer;
            format = 'jpeg';
        } else {
            processedBuffer = await sharp(imageBuffer).jpeg({ quality: 90 }).toBuffer();
            format = 'jpeg';
        }
        
        const base64 = processedBuffer.toString('base64');
        return `data:image/${format};base64,${base64}`;
    }

    /**
     * Parse LLM response to extract bounding boxes
     */
    private parseResponse(response: string, imgWidth: number, imgHeight: number): BoundingBox[] {
        try {
            // Try to extract JSON from the response
            let jsonStr = response.trim();
            
            // Handle cases where LLM adds extra text
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }
            
            const parsed = JSON.parse(jsonStr);
            const signatures = parsed.signatures || [];
            
            return signatures.map((sig: any) => {
                // Handle both x1,y1,x2,y2 and x1,y1,width,height formats
                let x1: number, y1: number, x2: number, y2: number;
                
                if ('width' in sig && 'height' in sig) {
                    // x1, y1, width, height format
                    x1 = sig.x1 * imgWidth;
                    y1 = sig.y1 * imgHeight;
                    x2 = (sig.x1 + sig.width) * imgWidth;
                    y2 = (sig.y1 + sig.height) * imgHeight;
                } else {
                    // x1, y1, x2, y2 format
                    x1 = sig.x1 * imgWidth;
                    y1 = sig.y1 * imgHeight;
                    x2 = sig.x2 * imgWidth;
                    y2 = sig.y2 * imgHeight;
                }
                
                // Ensure valid coordinates
                return {
                    x1: clip(Math.min(x1, x2), 0, imgWidth),
                    y1: clip(Math.min(y1, y2), 0, imgHeight),
                    x2: clip(Math.max(x1, x2), 0, imgWidth),
                    y2: clip(Math.max(y1, y2), 0, imgHeight),
                    confidence: clip(sig.confidence || sig.confidence_score || 0.5, 0, 1),
                    class_id: 0,
                    class_name: 'signature'
                };
            }).filter((box: BoundingBox) => {
                // Filter out invalid boxes
                const width = box.x2 - box.x1;
                const height = box.y2 - box.y1;
                return width > 5 && height > 5; // Minimum 5px size
            });
        } catch (error) {
            console.error('Failed to parse LLM response:', error);
            console.error('Raw response:', response);
            return [];
        }
    }

    /**
     * Detect signatures in image using LLM
     */
    async detect(imageBuffer: Buffer): Promise<DetectionResult> {
        const startTime = Date.now();
        
        // Get image dimensions
        const metadata = await sharp(imageBuffer).metadata();
        const imgWidth = metadata.width || 640;
        const imgHeight = metadata.height || 480;
        
        // Convert image to base64 URL
        const imageUrl = await this.imageToBase64Url(imageBuffer);
        
        try {
            // Call HuggingFace Inference API
            const response = await this.hf.chatCompletion({
                model: this.model,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                image_url: {
                                    url: imageUrl
                                }
                            },
                            {
                                type: 'text',
                                text: SIGNATURE_DETECTION_PROMPT
                            }
                        ]
                    }
                ],
                max_tokens: this.maxTokens,
                temperature: this.temperature
            });
            
            const inferenceTime = Date.now() - startTime;
            
            // Extract the generated text
            const generatedText = response.choices[0]?.message?.content || '{"signatures": []}';
            
            // Parse response to get bounding boxes
            const boxes = this.parseResponse(generatedText, imgWidth, imgHeight);
            
            return {
                boxes,
                inferenceTime,
                imageWidth: imgWidth,
                imageHeight: imgHeight
            };
        } catch (error: any) {
            console.error('LLM detection error:', error);
            throw new Error(`LLM detection failed: ${error.message}`);
        }
    }

    /**
     * Get current model name
     */
    getModel(): string {
        return this.model;
    }

    /**
     * Set model
     */
    setModel(model: string): void {
        this.model = model;
    }
}
