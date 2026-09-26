/* Applies saved accessibility preferences before the page paints,
   so text size / contrast / palette never "flash" on load.
   Loaded in <head> without defer on every page. */
(function () {
  var prefs = {};
  try { prefs = JSON.parse(localStorage.getItem("ra:prefs") || "{}"); } catch (e) { /* storage blocked */ }
  var root = document.documentElement;
  if (prefs.text && prefs.text !== "default") root.dataset.text = prefs.text;
  if (prefs.contrast === "high") root.dataset.contrast = "high";
  if (prefs.motion === "reduce") root.dataset.motion = "reduce";
  if (prefs.palette === "cb") root.dataset.palette = "cb";
})();
