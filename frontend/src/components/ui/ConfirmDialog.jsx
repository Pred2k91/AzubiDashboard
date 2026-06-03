import Modal from './Modal'

export default function ConfirmDialog({ open, onClose, onConfirm, title, message }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-slate-400 text-sm mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button className="btn-secondary" onClick={onClose}>Abbrechen</button>
        <button
          className="btn-danger"
          onClick={() => { onConfirm(); onClose() }}
        >
          Löschen
        </button>
      </div>
    </Modal>
  )
}
