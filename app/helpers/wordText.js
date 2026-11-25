/**
 * Remove spaces and characters you cannot see from the start and end of a
 * word: space, half-space (نیم‌فاصله, U+200C) and the other invisible marks a
 * keyboard can add. They are never part of a word; left in, they made a second
 * copy that looks the same ("راز " next to "راز").
 *
 * Spaces and half-spaces inside the word are kept exactly as typed.
 */
const EDGE = /^[\s​-‏⁠﻿]+|[\s​-‏⁠﻿]+$/g;

export function cleanEnds(text) {
    return typeof text === 'string' ? text.replace(EDGE, '') : text;
}

export default cleanEnds;
