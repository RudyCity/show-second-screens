/**
 * Shared Type Definitions for Show Second Screens
 */

export interface DisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TargetDisplay {
  id: string;
  name: string;
  bounds: DisplayBounds;
  scaleFactor: number;
  isPrimary: boolean;
  refreshRate?: number;
}

export type MouseButton = 'left' | 'right' | 'middle';

export type InputEventType =
  | 'mousemove'
  | 'mousedown'
  | 'mouseup'
  | 'click'
  | 'dblclick'
  | 'wheel'
  | 'keydown'
  | 'keyup';

export interface RemoteInputEvent {
  type: InputEventType;
  displayId: string;
  x: number;
  y: number;
  button?: MouseButton;
  deltaX?: number;
  deltaY?: number;
  key?: string;
  modifiers?: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  };
}

export interface WindowConfig {
  alwaysOnTop: boolean;
  opacity: number;
  aspectRatioLocked: boolean;
  showHud: boolean;
}

export interface CoordinateMappingParams {
  localX: number;
  localY: number;
  canvasWidth: number;
  canvasHeight: number;
  targetWidth: number;
  targetHeight: number;
  targetOriginX: number;
  targetOriginY: number;
}

export interface CoordinateMappingResult {
  targetX: number;
  targetY: number;
  isWithinBounds: boolean;
}
