import './ConfirmDialog.css';

type Props = {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Власне вікно підтвердження. Системний confirm() не скрізь показується
 * (вбудовані браузери та деякі встановлені PWA мовчки повертають «ні»).
 */
export function ConfirmDialog({ message, confirmLabel = 'Видалити', onConfirm, onCancel }: Props) {
  return (
    <div className="confirm-backdrop" onClick={onCancel}>
      <div
        className="confirm-box"
        role="alertdialog"
        aria-modal="true"
        aria-label={message}
        onClick={(e) => e.stopPropagation()}
      >
        <p>{message}</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onCancel}>
            Скасувати
          </button>
          <button type="button" className="btn danger" autoFocus onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
