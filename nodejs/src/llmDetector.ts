/**
 * LLM-based signature detector using Qwen2.5-VL via HuggingFace Inference API
 */

import { InferenceClient } from '@huggingface/inference';
import sharp from 'sharp';
import { BoundingBox, DetectionResult } from './types';
import { clip } from './utils';

// Default model
const DEFAULT_MODEL = 'Qwen/Qwen2.5-VL-72B-Instruct';

// Prompt for signature detection - honest confidence with full coverage
const SIGNATURE_DETECTION_PROMPT = `You are analyzing a document image to find handwritten signatures.

## YOUR TASK
Find ALL handwritten signatures and return their bounding boxes with HONEST confidence scores.

## WHAT IS A SIGNATURE
A signature is a PERSONAL HANDWRITTEN MARK used to authenticate documents:
- Cursive, flowing, connected strokes
- Stylized name or initials with personal flourishes
- Usually has loops, swirls, or underlines
- Ink strokes with pressure variations

## HONEST CONFIDENCE SCORING
The confidence score reflects: "How certain am I that this is a signature (not something else)?"

Score truthfully based on what you see:
- 0.95-1.00: Obviously a signature - cursive personal mark, unmistakable
- 0.85-0.94: Very likely signature - has signature characteristics, minor ambiguity
- 0.70-0.84: Probably signature - looks like one but could be fancy handwriting
- 0.50-0.69: Uncertain - might be signature OR might be other handwriting/marks
- 0.30-0.49: Unlikely signature - probably just handwriting or scribble
- Below 0.30: Not a signature - skip it

BE HONEST: If it looks ambiguous, give a LOW score (0.5-0.7). Only give HIGH scores (0.9+) for obvious signatures.

## DETECTING ON COMPLEX BACKGROUNDS
When the background has stamps, text, or other marks:

1. SCAN CAREFULLY: Look at the entire image, especially near:
   - Lines labeled "Signature", "Sign here", "Authorized by"
   - Bottom of documents
   - Next to stamps or seals (signatures often accompany stamps)

2. TRACE THE FULL SIGNATURE: Follow the ink strokes from start to end
   - Find where the signature STARTS (leftmost stroke)
   - Find where it ENDS (rightmost stroke, including flourishes)
   - Include the TOP (highest loop or ascender)
   - Include the BOTTOM (lowest descender or underline)

3. SEPARATE FROM OTHER ELEMENTS:
   - Stamps are usually RED/BLUE with geometric shapes or text inside circles/rectangles
   - Signatures are usually BLACK/BLUE with flowing organic curves
   - If signature overlaps stamp, the signature strokes are still visible - include them

## BOUNDING BOX RULES
Coordinates are fractions (0.0 to 1.0) of image width/height.

CRITICAL: Capture the ENTIRE signature, not just part of it!
- x1: Start 3-5% BEFORE the leftmost stroke
- x2: End 3-5% AFTER the rightmost stroke  
- y1: Start 3-5% ABOVE the highest point
- y2: End 3-5% BELOW the lowest point

It's better to have a slightly LARGER box than to CUT OFF part of the signature.

## OUTPUT FORMAT
Return ONLY this JSON, no other text:
{"signatures":[{"x1":0.10,"y1":0.72,"x2":0.40,"y2":0.84,"confidence":0.78}]}

Multiple signatures:
{"signatures":[{"x1":0.10,"y1":0.72,"x2":0.40,"y2":0.84,"confidence":0.82},{"x1":0.55,"y1":0.70,"x2":0.85,"y2":0.83,"confidence":0.65}]}

No signatures found:
{"signatures":[]}`;

export interface LLMDetectorOptions {
    hfToken: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    /** Padding percentage to add around bounding boxes (0.0 to 0.2, default 0.05 = 5%) */
    paddingPercent?: number;
}

export class LLMDetector {
    private hf: InferenceClient;
    private model: string;
    private maxTokens: number;
    private temperature: number;
    private paddingPercent: number;

    constructor(options: LLMDetectorOptions) {
        if (!options.hfToken) {
            throw new Error('HuggingFace token is required for LLM detector');
        }
        
        this.hf = new InferenceClient(options.hfToken);
        this.model = options.model || DEFAULT_MODEL;
        // More tokens to allow for detailed analysis
        this.maxTokens = options.maxTokens || 1200;
        // Moderate temperature for varied but consistent outputs
        this.temperature = options.temperature || 0.25;
        // Padding to add around detected signatures (5% by default - generous to avoid cutting)
        this.paddingPercent = clip(options.paddingPercent || 0.05, 0, 0.25);
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
            
            // Minimum confidence threshold - allow uncertain detections (0.40+)
            // User can filter by confidence in the UI if needed
            const MIN_CONFIDENCE = 0.40;
            
            // Use configured padding percentage
            const paddingPercent = this.paddingPercent;
            
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
                
                const confidence = clip(sig.confidence || sig.confidence_score || 0.6, 0, 1);
                
                // Calculate box dimensions
                const boxWidth = Math.abs(x2 - x1);
                const boxHeight = Math.abs(y2 - y1);
                
                // Apply confidence-based padding:
                // Lower confidence = more padding (boundary might be imprecise)
                // Higher confidence = base padding (LLM is more sure)
                let dynamicPadding = paddingPercent;
                if (confidence < 0.5) {
                    dynamicPadding = paddingPercent * 2.0; // 100% more padding for very uncertain
                } else if (confidence < 0.7) {
                    dynamicPadding = paddingPercent * 1.5; // 50% more padding
                } else if (confidence < 0.85) {
                    dynamicPadding = paddingPercent * 1.25; // 25% more padding
                }
                
                const padX = boxWidth * dynamicPadding;
                const padY = boxHeight * dynamicPadding;
                
                // Apply padding
                x1 = Math.min(x1, x2) - padX;
                y1 = Math.min(y1, y2) - padY;
                x2 = Math.max(x1 + boxWidth, x2) + padX;
                y2 = Math.max(y1 + boxHeight, y2) + padY;
                
                // Ensure valid coordinates (clipped to image bounds)
                return {
                    x1: clip(x1, 0, imgWidth),
                    y1: clip(y1, 0, imgHeight),
                    x2: clip(x2, 0, imgWidth),
                    y2: clip(y2, 0, imgHeight),
                    confidence,
                    class_id: 0,
                    class_name: 'signature'
                };
            }).filter((box: BoundingBox) => {
                // Filter out clearly invalid boxes only
                const width = box.x2 - box.x1;
                const height = box.y2 - box.y1;
                const aspectRatio = width / height;
                
                // Very lenient validation - let the confidence score do the filtering
                // 1. Minimum size: 15px (very small signatures are rare)
                // 2. Maximum size: 85% of image (signature shouldn't cover entire image)
                // 3. Aspect ratio: 0.3 to 15 (very permissive)
                // 4. Confidence threshold: 0.40 (allow uncertain detections)
                
                const validMinSize = width > 15 && height > 8;
                const validMaxSize = width < imgWidth * 0.85 && height < imgHeight * 0.6;
                const validAspectRatio = aspectRatio > 0.3 && aspectRatio < 15;
                const validConfidence = box.confidence >= MIN_CONFIDENCE;
                
                const isValid = validMinSize && validMaxSize && validConfidence && validAspectRatio;
                
                if (!isValid) {
                    console.log(`[LLM] Filtered: conf=${box.confidence.toFixed(2)}, aspect=${aspectRatio.toFixed(2)}, size=${width.toFixed(0)}x${height.toFixed(0)}`);
                }
                
                return isValid;
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
            // System message for honest confidence and full detection
            const systemMessage = `You detect signatures in documents. Be HONEST with confidence scores.

CONFIDENCE MEANING:
- High (0.85+): You are SURE this is a signature
- Medium (0.6-0.84): You THINK this is a signature but not certain
- Low (0.4-0.59): This MIGHT be a signature or might be something else

NEVER give 0.95 to everything. If unsure, give 0.5-0.7.
ALWAYS capture the FULL signature - don't cut off any strokes.
Output ONLY valid JSON.`;

            // Call HuggingFace Inference API
            const response = await this.hf.chatCompletion({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: systemMessage
                    },
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
            
            // Log for debugging
            console.log(`[LLM] Model: ${this.model}`);
            console.log(`[LLM] Inference time: ${inferenceTime}ms`);
            console.log(`[LLM] Raw response: ${generatedText.substring(0, 500)}...`);
            
            // Parse response to get bounding boxes
            const boxes = this.parseResponse(generatedText, imgWidth, imgHeight);
            
            console.log(`[LLM] Detected ${boxes.length} signature(s)`);
            
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
