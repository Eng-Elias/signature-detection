/**
 * Utility functions for image processing and NMS
 */

import { BoundingBox } from './types';

/**
 * Calculate intersection area of two boxes
 */
export function intersection(box1: BoundingBox, box2: BoundingBox): number {
    const x1 = Math.max(box1.x1, box2.x1);
    const y1 = Math.max(box1.y1, box2.y1);
    const x2 = Math.min(box1.x2, box2.x2);
    const y2 = Math.min(box1.y2, box2.y2);
    
    if (x2 < x1 || y2 < y1) return 0;
    return (x2 - x1) * (y2 - y1);
}

/**
 * Calculate union area of two boxes
 */
export function union(box1: BoundingBox, box2: BoundingBox): number {
    const area1 = (box1.x2 - box1.x1) * (box1.y2 - box1.y1);
    const area2 = (box2.x2 - box2.x1) * (box2.y2 - box2.y1);
    return area1 + area2 - intersection(box1, box2);
}

/**
 * Calculate Intersection over Union
 */
export function iou(box1: BoundingBox, box2: BoundingBox): number {
    const intersectionArea = intersection(box1, box2);
    if (intersectionArea === 0) return 0;
    return intersectionArea / union(box1, box2);
}

/**
 * Non-Maximum Suppression
 */
export function nms(boxes: BoundingBox[], iouThreshold: number = 0.5): BoundingBox[] {
    if (boxes.length === 0) return [];

    // Sort boxes by confidence (descending)
    const sortedBoxes = [...boxes].sort((a, b) => b.confidence - a.confidence);
    const selectedBoxes: BoundingBox[] = [];

    while (sortedBoxes.length > 0) {
        const currentBox = sortedBoxes.shift()!;
        selectedBoxes.push(currentBox);

        // Remove boxes with high IoU
        for (let i = sortedBoxes.length - 1; i >= 0; i--) {
            if (iou(currentBox, sortedBoxes[i]) > iouThreshold) {
                sortedBoxes.splice(i, 1);
            }
        }
    }

    return selectedBoxes;
}

/**
 * Clip value between min and max
 */
export function clip(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Convert xywh format to xyxy format
 */
export function xywh2xyxy(x: number, y: number, w: number, h: number): [number, number, number, number] {
    const x1 = x - w / 2;
    const y1 = y - h / 2;
    const x2 = x + w / 2;
    const y2 = y + h / 2;
    return [x1, y1, x2, y2];
}

/**
 * Scale coordinates from model space to image space
 */
export function scaleCoordinates(
    coords: [number, number, number, number],
    originalWidth: number,
    originalHeight: number,
    modelSize: number
): [number, number, number, number] {
    const [x1, y1, x2, y2] = coords;
    const scaleX = originalWidth / modelSize;
    const scaleY = originalHeight / modelSize;
    
    return [
        x1 * scaleX,
        y1 * scaleY,
        x2 * scaleX,
        y2 * scaleY
    ];
}
