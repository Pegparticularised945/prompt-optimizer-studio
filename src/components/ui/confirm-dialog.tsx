import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, X } from 'lucide-react'
import { useRef, useState } from 'react'

export function ConfirmDialog({
  title,
  description,
  confirmText,
  cancelText = '返回',
  tone = 'neutral',
  disabled,
  onConfirm,
  children,
}: {
  title: string
  description: string
  confirmText: string
  cancelText?: string
  tone?: 'danger' | 'neutral'
  disabled?: boolean
  onConfirm: () => void | Promise<void>
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)

  async function handleConfirm() {
    setConfirming(true)
    try {
      await onConfirm()
      setOpen(false)
    } finally {
      setConfirming(false)
    }
  }

  const confirmClass = tone === 'danger' ? 'button danger' : 'button secondary'

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild disabled={disabled}>
        {children}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            cancelButtonRef.current?.focus()
          }}
        >
          <div className="dialog-head">
            <span className={`dialog-icon${tone === 'danger' ? ' danger' : ''}`}>
              <AlertTriangle size={18} />
            </span>
            <div className="dialog-copy">
              <Dialog.Title className="dialog-title">{title}</Dialog.Title>
              <Dialog.Description className="dialog-description">{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="icon-button dialog-close" aria-label="关闭确认窗口">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="dialog-actions">
            <Dialog.Close asChild>
              <button
                ref={cancelButtonRef}
                type="button"
                className="button ghost"
                disabled={confirming}
              >
                {cancelText}
              </button>
            </Dialog.Close>
            <button
              type="button"
              className={confirmClass}
              onClick={() => void handleConfirm()}
              disabled={confirming}
            >
              {confirming ? '处理中...' : confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

