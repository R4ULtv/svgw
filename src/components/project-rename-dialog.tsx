import { useEffect, useId, useRef, useState } from 'react'
import { useCommandScope } from './commands'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Input } from './ui/input'

export function ProjectRenameDialog({
  open,
  onOpenChange,
  name,
  onRename,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  onRename: (name: string) => void
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(name)
  useEffect(() => {
    if (open) setDraft(name)
  }, [open, name])
  useCommandScope('dialog', open)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent initialFocus={input} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>Give your project a name that’s easy to find again.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!draft.trim()) return
            onRename(draft.trim())
            onOpenChange(false)
          }}
        >
          <div className="grid gap-2">
            <label htmlFor={id} className="text-xs font-medium">
              Project name
            </label>
            <Input
              ref={input}
              id={id}
              value={draft}
              maxLength={200}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!draft.trim()}>
              Save name
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
