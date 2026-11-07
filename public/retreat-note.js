// Retreat note (2026-11-07): from 2026-12-08 00:00 ET (05:00 UTC) show the usual reply promise again.
(function () {
  if (Date.now() < Date.UTC(2026, 11, 8, 5)) return;
  document.querySelectorAll('[data-retreat="on"]').forEach(function (e) { e.hidden = true; });
  document.querySelectorAll('[data-retreat="off"]').forEach(function (e) { e.hidden = false; });
})();
