// Console errors the e2e guard ignores because they are not site bugs (FEATURES.md MATRIX-05).
// Firefox logs "downloadable font: download failed … status=2152398850" when a navigation aborts a
// font that is still downloading. 2152398850 is NS_BINDING_ABORTED. Any other font error still fails.
const ABORTED_FONT = /downloadable font: download failed\b.*\bstatus=2152398850\b/s;

export const isIgnoredConsoleError = (text) => ABORTED_FONT.test(text);
