/**
 * Shared Constants and IPC Channel Names
 */

export const IPC_CHANNELS = {
  // Displays
  GET_DISPLAYS: 'display:get-all',
  SELECT_DISPLAY: 'display:select',
  DISPLAY_CHANGED: 'display:changed',

  // Input Injection
  SEND_INPUT: 'input:send-event',

  // Window Controls
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_SET_ALWAYS_ON_TOP: 'window:set-always-on-top',
  WINDOW_SET_OPACITY: 'window:set-opacity',
} as const;

export const DEFAULT_WINDOW_CONFIG = {
  width: 960,
  height: 540,
  minWidth: 320,
  minHeight: 180,
  defaultOpacity: 1.0,
  defaultAlwaysOnTop: true,
} as const;
