// What the desktop app remembers between launches (window place, last save
// folder, theme), in one small JSON file under the user's data folder.
const fs = require('node:fs');
const path = require('node:path');

function createDesktopState(directory) {
  const file = path.join(directory, 'desktop-state.json');
  let state = {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) state = parsed;
  } catch {
    // First launch, or a damaged file: start afresh
  }
  return {
    get: (key) => state[key],
    set(key, value) {
      state = { ...state, [key]: value };
      try {
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(file, JSON.stringify(state));
      } catch {
        // Read-only profile: remembered for this session only
      }
    },
  };
}

module.exports = { createDesktopState };
