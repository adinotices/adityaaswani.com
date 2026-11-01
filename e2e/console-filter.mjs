// Console errors the e2e guard ignores because they are not site bugs (FEATURES.md MATRIX-05).
// Firefox logs "downloadable font: download failed … status=2152398850" when a navigation aborts a
// font that is still downloading. 2152398850 is NS_BINDING_ABORTED. Any other font error still fails.
const ABORTED_FONT = /downloadable font: download failed\b.*\bstatus=2152398850\b/s;

// Chromium cancels loads in flight with net::ERR_NETWORK_CHANGED when the machine's network interfaces
// change, localhost included. Not a site bug: the shared gcp runner VM hosts five repos' jobs (PR #55,
// run 41291487197, NAV-01 with its own assertions passing; MATRIX-09). Exact name only: every other
// net:: error still fails.
const NETWORK_CHANGED = /\bnet::ERR_NETWORK_CHANGED\b/;

export const isIgnoredConsoleError = (text) => ABORTED_FONT.test(text) || NETWORK_CHANGED.test(text);

// Why a same-origin request failed; true when that is no fault of the site: a navigation or our own
// abort cut it off, or the machine's network changed.
export const isIgnoredRequestFailure = (why) => /ABORTED|cancelled|NS_BINDING_ABORTED/i.test(why) || NETWORK_CHANGED.test(why);
