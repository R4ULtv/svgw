import { useId, useState } from 'react'
import { ArrowUpRightIcon } from 'lucide-react'
import { useAdminSession } from '@/lib/admin-session'
import { useCommands, useCommandScope } from './commands'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Spinner } from './ui/spinner'

export function LoginButton() {
  const session = useAdminSession()
  const keyId = useId()
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useCommandScope('dialog', open)
  useCommands({ 'cloud.connect': () => setOpen(true) })

  function changeOpen(value: boolean) {
    setOpen(value)
    if (!value) {
      setKey('')
      setError(null)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={!session.authReady || busy}
        onClick={() => (session.admin ? session.lock() : changeOpen(true))}
      >
        {session.admin ? 'Logout' : 'Login'}
      </Button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{session.admin ? 'Remote access' : 'Login'}</DialogTitle>
            <DialogDescription>
              {session.admin
                ? 'You are logged in. Changes can be saved online.'
                : 'Enter the key to save projects online. You’ll stay logged in on this browser for 7 days, unless you log out.'}
            </DialogDescription>
          </DialogHeader>
          {session.admin ? (
            <Button
              variant="outline"
              onClick={() => {
                session.lock()
                changeOpen(false)
              }}
            >
              Logout
            </Button>
          ) : (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                setBusy(true)
                setError(null)
                void session
                  .unlock(key)
                  .then(() => changeOpen(false))
                  .catch((cause: unknown) =>
                    setError(cause instanceof Error ? cause.message : 'Could not log in.'),
                  )
                  .finally(() => setBusy(false))
              }}
            >
              <label htmlFor={keyId} className="text-xs font-medium">
                Key
              </label>
              <Input
                id={keyId}
                type="password"
                autoComplete="off"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="Enter the key"
                required
              />
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy || !key.trim()}>
                {busy && <Spinner />}Login
              </Button>
            </form>
          )}
          <div className="grid gap-2 border-t pt-3 text-muted-foreground">
            <p>
              If you don’t have remote access, you can create and host your own version of svgw.
            </p>
            <a
              href="https://github.com/r4ultv/svgw"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-fit items-center gap-1.5 text-foreground underline underline-offset-4 hover:text-primary"
            >
              View on GitHub
              <ArrowUpRightIcon className="size-3" />
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
