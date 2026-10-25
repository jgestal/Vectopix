// Turns the menu the interface describes (see src/domain/menu.ts and
// src/infrastructure/desktop/protocol.ts) into Electron's menu template.
// Pure: no Electron imports, so it is tested without launching the app.

const ROLES = new Set([
  'cut', 'copy', 'paste', 'selectAll', 'services', 'hide', 'hideOthers', 'unhide', 'quit', 'close',
  'minimize', 'zoom', 'front', 'togglefullscreen', 'toggleDevTools', 'clearRecentDocuments',
]);

/** @param {(command: string) => void} send */
function toTemplateItem(item, send) {
  switch (item.kind) {
    case 'separator':
      return { type: 'separator' };
    case 'role':
      // Only known system roles: the page can't name arbitrary ones
      return ROLES.has(item.role) ? { role: item.role, label: item.label } : { type: 'separator' };
    case 'submenu':
      return {
        label: item.label,
        ...(item.recentDocuments ? { role: 'recentDocuments' } : {}),
        submenu: item.items.map((i) => toTemplateItem(i, send)),
      };
    default:
      return {
        id: item.command,
        label: item.label,
        enabled: item.enabled,
        ...(item.type ? { type: item.type, checked: !!item.checked } : {}),
        ...(item.accelerator ? { accelerator: item.accelerator, registerAccelerator: item.registerAccelerator !== false } : {}),
        click: () => send(item.command),
      };
  }
}

// macOS lists the open windows under the Window role and adds search to Help
const SECTION_ROLES = { windowMenu: 'window', help: 'help' };

/** @param {Array} sections @param {(command: string) => void} send */
function toMenuTemplate(sections, send) {
  return sections.map((section) => ({
    label: section.label,
    ...(SECTION_ROLES[section.role] ? { role: SECTION_ROLES[section.role] } : {}),
    submenu: section.items.map((item) => toTemplateItem(item, send)),
  }));
}

module.exports = { toMenuTemplate };
