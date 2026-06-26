export const MAX_SLOTS = 4;

/**
 * @typedef {Object} VideoSource
 * @property {string} id YouTube video id.
 * @property {string} url Original URL provided by the user or captured tab.
 * @property {string=} title Optional display title.
 * @property {string=} thumbnail Optional thumbnail URL.
 * @property {boolean=} isLive Optional live hint.
 */

/**
 * @typedef {Object} MultiviewSlot
 * @property {0|1|2|3} index Slot index.
 * @property {VideoSource|null} source Loaded source.
 * @property {boolean} muted Whether the slot is muted.
 * @property {number} volume Volume between 0 and 100.
 * @property {boolean} active Whether this slot owns the main audio focus.
 */

/**
 * @typedef {"single"|"two-columns"|"three-grid"|"four-grid"} LayoutMode
 */

/**
 * @typedef {Object} MultiviewRoomState
 * @property {MultiviewSlot[]} slots Room slots.
 * @property {LayoutMode} layout Current layout mode.
 * @property {number|null} activeSlotIndex Current focused audio slot.
 * @property {string} updatedAt ISO timestamp.
 */
