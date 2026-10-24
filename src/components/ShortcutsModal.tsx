import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Espacio + Arrastrar', desc: 'Mover el lienzo libremente (Pan)' },
    { key: 'Rueda del Ratón', desc: 'Zoom continuo hacia el cursor' },
    { key: 'S', desc: 'Alternar vista Split (Cortinilla Antes / Después)' },
    { key: 'D', desc: 'Alternar vista Doble Panel (Side-by-Side)' },
    { key: 'W', desc: 'Alternar modo Contornos (Estructura alámbrica)' },
    { key: 'E / N', desc: 'Activar / Desactivar el Editor de Nodos' },
    { key: 'Clic en nodo', desc: 'Seleccionar nodo y mostrar tiradores Bézier' },
    { key: 'Supr / Backspace', desc: 'Eliminar el nodo seleccionado en el editor' },
    { key: 'Cmd/Ctrl + Z', desc: 'Deshacer modificación de nodos' },
    { key: 'Cmd/Ctrl + Shift + Z', desc: 'Rehacer modificación de nodos' },
    { key: 'Cmd/Ctrl + C', desc: 'Copiar código SVG al portapapeles' },
    { key: 'Cmd/Ctrl + V', desc: 'Pegar imagen desde el portapapeles en cualquier momento' },
    { key: 'Esc', desc: 'Cerrar ventanas modales / Deseleccionar nodo' },
    { key: '?', desc: 'Abrir este panel de atajos de teclado' },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="shortcuts-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="title-with-icon">
              <Keyboard size={18} className="text-cyan" />
              <h2 className="modal-title">Atajos de Teclado del Estudio</h2>
            </div>
            <span className="modal-subtitle">
              Navega y edita a la velocidad de un diseñador profesional
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="shortcuts-grid">
          {shortcuts.map((sc, i) => (
            <div key={i} className="shortcut-row">
              <span className="shortcut-desc">{sc.desc}</span>
              <kbd className="shortcut-key">{sc.key}</kbd>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
