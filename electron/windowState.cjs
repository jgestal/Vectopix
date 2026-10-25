// Where to open the window: where it was last time, if that is still on a
// screen. Pure: no Electron imports, tested on its own.

/** At least this much of the window (px) must be on a screen to count as visible. */
const MIN_VISIBLE = 100;

const overlap = (a, b) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

const isRect = (r) => r && ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(r[k]));

/**
 * @param saved the bounds stored when the window last closed (may be missing or junk)
 * @param workAreas the screens' usable areas now
 * @param size the default size, centred on the first screen when nothing usable was saved
 */
function restoreBounds(saved, workAreas, size) {
  const fits = isRect(saved) && saved.width >= size.minWidth && saved.height >= size.minHeight;
  // A monitor unplugged, or the resolution changed: the saved place may be off screen
  if (fits && workAreas.some((area) => overlap(saved, area) >= MIN_VISIBLE * MIN_VISIBLE)) {
    return { x: saved.x, y: saved.y, width: saved.width, height: saved.height };
  }
  const area = workAreas[0];
  const width = Math.min(size.width, area.width);
  const height = Math.min(size.height, area.height);
  return { x: area.x + Math.round((area.width - width) / 2), y: area.y + Math.round((area.height - height) / 2), width, height };
}

module.exports = { restoreBounds };
