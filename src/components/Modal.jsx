import { useEffect, useRef } from "react";
import Icon from "./Icon";
import { usePreferences } from "../context/PreferencesContext";
export default function Modal({ title, children, onClose }) {
  const dialog = useRef(null);
  const { copy: c } = usePreferences();
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <button className="modal-close" aria-label={c.close} onClick={onClose}>
          <Icon name="close" />
        </button>
        <h2 id="modal-title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
