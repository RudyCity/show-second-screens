import { CoordinateMappingParams, CoordinateMappingResult } from '../types/index.js';

/**
 * Maps coordinates from the local preview canvas to the target physical display.
 * Accounts for letterboxing/pillarboxing when aspect ratios differ.
 */
export function mapCanvasToTargetDisplay(
  params: CoordinateMappingParams
): CoordinateMappingResult {
  const {
    localX,
    localY,
    canvasWidth,
    canvasHeight,
    targetWidth,
    targetHeight,
    targetOriginX,
    targetOriginY,
  } = params;

  if (canvasWidth <= 0 || canvasHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return { targetX: 0, targetY: 0, isWithinBounds: false };
  }

  // Calculate scale factor preserving target aspect ratio
  const scale = Math.min(canvasWidth / targetWidth, canvasHeight / targetHeight);
  const renderWidth = targetWidth * scale;
  const renderHeight = targetHeight * scale;

  // Offsets due to letterbox or pillarbox
  const offsetX = (canvasWidth - renderWidth) / 2;
  const offsetY = (canvasHeight - renderHeight) / 2;

  // Relative normalized coordinates [0, 1]
  const relX = localX - offsetX;
  const relY = localY - offsetY;

  const isWithinBounds =
    relX >= 0 && relX <= renderWidth && relY >= 0 && relY <= renderHeight;

  if (!isWithinBounds) {
    return {
      targetX: Math.round(targetOriginX + (Math.max(0, Math.min(renderWidth, relX)) / renderWidth) * targetWidth),
      targetY: Math.round(targetOriginY + (Math.max(0, Math.min(renderHeight, relY)) / renderHeight) * targetHeight),
      isWithinBounds: false,
    };
  }

  const u = relX / renderWidth;
  const v = relY / renderHeight;

  const targetX = Math.round(targetOriginX + u * targetWidth);
  const targetY = Math.round(targetOriginY + v * targetHeight);

  return {
    targetX,
    targetY,
    isWithinBounds: true,
  };
}
