import React, { useEffect, useRef, useState } from 'react';

export type MenuItem =
  | { label: string; onSelect: () => void; shortcut?: string; checked?: boolean; disabled?: boolean }
  | 'separator';

export interface Menu {
  id: string;
  label: string;
  items: MenuItem[];
}

/**
 * Classic menu bar: click a title to open its menu, then hover across the
 * bar to switch menus, like Windows does. Escape or a click outside closes it.
 */
export const MenuBar: React.FC<{ menus: Menu[] }> = ({ menus }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!openId) return;
    const close = (e: MouseEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [openId]);

  return (
    <nav className="r-menubar" ref={barRef} role="menubar">
      {menus.map((menu) => (
        <div key={menu.id} className="r-menu">
          <button
            className={`r-menu-title ${openId === menu.id ? 'is-open' : ''}`}
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={openId === menu.id}
            onClick={() => setOpenId(openId === menu.id ? null : menu.id)}
            onMouseEnter={() => openId && setOpenId(menu.id)}
          >
            {menu.label}
          </button>
          {openId === menu.id && (
            <ul className="r-menu-popup" role="menu">
              {menu.items.map((item, i) =>
                item === 'separator' ? (
                  <li key={i} className="r-separator" role="separator" />
                ) : (
                  <li key={i} role="none">
                    <button
                      className="r-menu-item"
                      role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                      aria-checked={item.checked}
                      disabled={item.disabled}
                      onClick={() => {
                        setOpenId(null);
                        item.onSelect();
                      }}
                    >
                      <span className="r-menu-check">{item.checked ? '●' : ''}</span>
                      <span className="r-menu-label">{item.label}</span>
                      <span className="r-menu-shortcut">{item.shortcut}</span>
                    </button>
                  </li>
                )
              )}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
};
