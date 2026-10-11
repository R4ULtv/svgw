import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  FolderOpenIcon,
  LayersIcon,
  MonitorIcon,
  MoonIcon,
  PenToolIcon,
  SunIcon,
  UploadIcon,
} from 'lucide-react'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme, type ThemePreference } from '@/components/theme'
import { ArtworkMark, artworkSvg, palettes, playgroundExamples, type Artwork } from './artwork'
import { CloudflareLogo, GitHubLogo, ReactLogo } from './brand-icons'

const REPOSITORY_URL = 'https://github.com/r4ultv/svgw'
const WEBSITE_URL = 'https://www.raulcarini.dev'
const AUTHOR_GITHUB_URL = 'https://github.com/R4ULtv'

interface LandingProps {
  onCreate: (svg?: string, name?: string) => void
  onImport: (file: File) => void
  busy: boolean
  projects: ReactNode
}

export function LandingNextPage({ onCreate, onImport, busy, projects }: LandingProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  return (
    <div className="next-landing min-h-dvh text-foreground bg-background [&_svg]:shrink-0 [&_a]:[-webkit-tap-highlight-color:transparent] [&_button]:[-webkit-tap-highlight-color:transparent] [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-solid [&_a:focus-visible]:outline-ring [&_a:focus-visible]:outline-offset-5 [&_button:focus-visible]:outline-2! [&_button:focus-visible]:outline-solid [&_button:focus-visible]:outline-ring [&_button:focus-visible]:outline-offset-5 [&_input:focus-visible]:outline-2 [&_input:focus-visible]:outline-solid [&_input:focus-visible]:outline-ring [&_input:focus-visible]:outline-offset-5 [&_button:disabled]:cursor-wait [&_button:disabled]:opacity-55 motion-reduce:[&_*]:transition-none! motion-reduce:[&_*]:animate-none! motion-reduce:[&_*]:scroll-auto!">
      <a
        className="next-skip fixed top-[-70px] left-5 z-100 bg-background p-3 focus:top-3"
        href="#next-main"
      >
        Skip to content
      </a>
      <header className="next-nav min-h-19 flex items-center gap-10.5 border-b max-[761px]:min-h-17 max-[761px]:gap-3.5 max-[481px]:[&_.next-brand_>_svg]:w-7 max-[481px]:[&_.next-brand_>_svg]:h-7 next-wide w-[min(1200px,_calc(100%_-_80px))] mx-auto max-[761px]:w-[calc(100%_-_40px)]">
        <a
          href="/landing-next"
          className="next-brand inline-flex items-center gap-2.5 text-[21px] font-semibold tracking-[-.045em] max-[481px]:gap-2 max-[481px]:text-[18px]"
          aria-label="svgw home"
        >
          <Logo className="size-8" />
          <span>svgw.</span>
        </a>
        <nav
          aria-label="Main navigation"
          className="next-nav-links flex items-center gap-7 text-muted-foreground text-[13px] [&_>_a]:flex [&_>_a]:items-center [&_>_a]:min-h-10 [&_>_a:hover]:text-foreground max-[761px]:hidden"
        >
          <Link to="/projects">Projects</Link>
          <a href="#self-host">Self-host</a>
        </nav>
        <div className="next-nav-actions flex items-center ml-auto gap-5 max-[761px]:gap-2">
          <NavigationMenu />
          <Button
            disabled={busy}
            onClick={() => onCreate()}
            className="next-nav-open h-9.5 px-4 text-[12px] gap-3 max-[761px]:h-10 max-[761px]:text-[12px] max-[761px]:px-3 max-[481px]:px-2.5 max-[481px]:gap-2 max-[481px]:[&_>_svg]:w-3.5 max-[481px]:[&_>_svg]:h-3.5 leading-[1.3333333333]"
          >
            Open editor
            <ArrowRightIcon className="size-4 max-[481px]:size-3.5" />
          </Button>
        </div>
      </header>

      <main id="next-main">
        <section className="next-hero grid grid-cols-[.95fr_1.05fr] items-center gap-16 pt-19 pb-20 max-[1051px]:gap-9 max-[761px]:grid-cols-1 max-[761px]:pt-13 max-[761px]:pb-13.75 max-[761px]:gap-9.5 next-container w-[min(1120px,_calc(100%_-_80px))] mx-auto max-[761px]:w-[calc(100%_-_40px)]">
          <div className="next-hero-copy [&_h1]:text-[clamp(64px,_6.8vw,_88px)] [&_h1]:leading-[1.03] [&_>_p]:text-[16px] [&_>_p]:leading-[1.75] [&_>_p]:max-w-97.5 [&_>_p]:mt-7.5 [&_.next-local-note]:flex [&_.next-local-note]:items-center [&_.next-local-note]:gap-2 [&_.next-local-note]:mt-4.5 [&_.next-local-note]:text-[12px] max-[1051px]:[&_h1]:text-[67px] max-[1051px]:[&_>_p]:text-[15px] max-[761px]:[&_h1]:text-[clamp(56px,_11vw,_80px)] max-[761px]:[&_>_p]:max-w-115 max-[761px]:[&_>_p]:mt-5.75 max-[761px]:[&_>_p]:text-[15px] max-[481px]:[&_h1]:text-[clamp(49px,_15.5vw,_67px)] max-[481px]:[&_>_p]:text-[14px] max-[481px]:[&_>_p]:leading-[1.7]">
            <h1 className="font-medium tracking-[-.055em]">
              Less setup.
              <br />
              More play.
            </h1>
            <p className="text-muted-foreground">
              Draw, edit, and export SVGs in a small, focused workspace. Free to use, with drafts
              saved in your browser.
            </p>
            <div className="next-start-actions flex items-center flex-wrap gap-2.5 mt-7.5 max-[761px]:mt-6">
              <Button
                disabled={busy}
                onClick={() => onCreate()}
                className="next-action h-11.5 px-5 text-[13px] gap-3.5 max-[481px]:text-[12px] max-[481px]:h-11 max-[481px]:px-4 max-[481px]:gap-2.5 leading-[1.3333333333]"
              >
                Open editor
                <ArrowRightIcon />
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
                className="next-action h-11.5 px-5 text-[13px] gap-3.5 max-[481px]:text-[12px] max-[481px]:h-11 max-[481px]:px-4 max-[481px]:gap-2.5 leading-[1.3333333333]"
              >
                <UploadIcon />
                Open an SVG
              </Button>
            </div>
            <p className="next-local-note [&_>_svg]:w-3.25 [&_>_svg]:h-3.25 text-muted-foreground">
              <CheckIcon />
              Local autosave. No account needed.
            </p>
            <a
              href="#self-host"
              className="next-host-link inline-flex text-[12px] mt-4.75 text-muted-foreground underline underline-offset-4 decoration-border hover:text-foreground hover:decoration-current"
            >
              Want remote saving? Host your own.
            </a>
          </div>
          <InteractiveCanvas onCreate={onCreate} busy={busy} />
        </section>

        <section
          className="next-capabilities grid grid-cols-3 gap-x-12.5 border-y pt-8 pb-8.75 [&_>_div]:grid [&_>_div]:grid-cols-[19px_1fr] [&_>_div]:gap-y-2.25 [&_>_div]:gap-x-3 [&_>_div]:content-start [&_svg]:w-4.5 [&_svg]:h-4.5 [&_svg]:mt-0.5 [&_svg]:text-muted-foreground [&_h2]:text-[16px] [&_h2]:font-medium [&_h2]:tracking-[-.025em] [&_p]:col-start-2 [&_p]:text-[12px] [&_p]:leading-[1.7] [&_p]:max-w-65 max-[1051px]:gap-x-6.25 max-[761px]:gap-x-5 max-[761px]:[&_h2]:text-[14px] max-[761px]:[&_p]:text-[11px] max-[761px]:[&_>_div]:grid-cols-1 max-[761px]:[&_>_div]:gap-3 max-[761px]:[&_p]:col-start-1 max-[481px]:grid-cols-1 max-[481px]:gap-6.75 max-[481px]:py-7.5 max-[481px]:[&_>_div]:grid-cols-[18px_1fr] max-[481px]:[&_>_div]:gap-y-2 max-[481px]:[&_>_div]:gap-x-3.5 max-[481px]:[&_h2]:text-[16px] max-[481px]:[&_p]:col-start-2 max-[481px]:[&_p]:text-[12px] max-[481px]:[&_p]:max-w-full next-container w-[min(1120px,_calc(100%_-_80px))] mx-auto max-[761px]:w-[calc(100%_-_40px)]"
          aria-label="SVG editing tools"
        >
          <div>
            <PenToolIcon />
            <h2 className="font-medium tracking-[-.055em]">Paths and shapes</h2>
            <p className="text-muted-foreground">
              Draw paths, adjust curves, and work with shapes.
            </p>
          </div>
          <div>
            <LayersIcon />
            <h2 className="font-medium tracking-[-.055em]">Layers</h2>
            <p className="text-muted-foreground">Organize, hide, and lock artwork with layers.</p>
          </div>
          <div>
            <DownloadIcon />
            <h2 className="font-medium tracking-[-.055em]">SVG export</h2>
            <p className="text-muted-foreground">
              Download an editable SVG or an optimized export.
            </p>
          </div>
        </section>

        <section
          id="self-host"
          className="next-storage grid grid-cols-[.95fr_1.05fr] gap-16 py-21.25 max-[1051px]:gap-9 max-[761px]:grid-cols-1 max-[761px]:py-13.75 max-[761px]:gap-7.5 next-container w-[min(1120px,_calc(100%_-_80px))] mx-auto max-[761px]:w-[calc(100%_-_40px)]"
          aria-labelledby="next-storage-heading"
        >
          <div className="next-storage-copy [&_h2]:text-[43px] [&_h2]:leading-[1.15] [&_>_p]:text-[14px] [&_>_p]:leading-[1.8] [&_>_p]:max-w-102.5 [&_>_p]:mt-6 max-[1051px]:[&_h2]:text-[37px] max-[761px]:[&_>_p]:max-w-125 max-[761px]:[&_>_p]:mt-4.75 max-[481px]:[&_h2]:text-[34px] max-[481px]:[&_>_p]:text-[13px]">
            <h2 className="font-medium tracking-[-.055em]" id="next-storage-heading">
              Free in your browser.
              <br />
              Yours to host.
            </h2>
            <p className="text-muted-foreground">
              Use this website for local editing. For remote saving, version history, and
              publishing, download the source and run your own instance.
            </p>
            <a
              className="next-source-link inline-flex items-center gap-2.25 mt-6 text-[13px] font-medium [&_>_svg]:w-4 [&_>_svg]:h-4 hover:underline hover:underline-offset-4"
              href={REPOSITORY_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitHubLogo />
              Get the source on GitHub
              <ArrowRightIcon />
            </a>
            <a
              className="next-guide-link block w-fit text-muted-foreground mt-3.5 text-[12px] underline underline-offset-4 decoration-border hover:text-foreground"
              href={REPOSITORY_URL + '#cloudflare'}
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the self-hosting guide
            </a>
          </div>
          <div className="next-storage-options border self-start">
            <div className="next-storage-option p-6 [&_+_.next-storage-option]:border-t [&_+_.next-storage-option]:bg-[color-mix(in_oklch,_var(--muted)_45%,_var(--background))] [&_>_p]:text-[12px] [&_>_p]:leading-[1.7] [&_>_p]:mt-4 [&_>_p]:max-w-107.5 max-[1051px]:p-5">
              <div className="next-storage-title flex items-center gap-3 [&_>_svg]:w-7.75 [&_>_svg]:h-7.75 [&_h3]:text-[14px] [&_h3]:font-medium [&_h3]:flex-1 [&_>_span]:pt-1 [&_>_span]:pr-1.75 [&_>_span]:pb-1 [&_>_span]:pl-1.75 [&_>_span]:text-[9px] [&_>_span]:border [&_>_span]:text-muted-foreground [&_>_span]:whitespace-nowrap [&_.next-cloudflare]:text-[#f38020] max-[481px]:gap-2.5 max-[481px]:[&_>_svg]:w-6.75 max-[481px]:[&_>_svg]:h-6.75 max-[481px]:[&_h3]:text-[13px] max-[481px]:[&_>_span]:text-[8px] max-[481px]:[&_>_span]:pt-1 max-[481px]:[&_>_span]:pr-1.25 max-[481px]:[&_>_span]:pb-1 max-[481px]:[&_>_span]:pl-1.25">
                <Logo className="size-8" />
                <h3>On this website</h3>
                <span>Free</span>
              </div>
              <p className="text-muted-foreground">
                Your projects stay in this browser. Import an SVG, edit it, and download your work.
              </p>
              <div className="next-storage-details flex flex-wrap gap-3.75 text-muted-foreground text-[10px] mt-4.25 [&_>_span]:inline-flex [&_>_span]:items-center [&_>_span]:gap-1.5 [&_svg]:w-3 [&_svg]:h-3 max-[481px]:gap-3 max-[481px]:text-[9px]">
                <span>
                  <CheckIcon />
                  Local autosave
                </span>
                <span>
                  <CheckIcon />
                  SVG import & export
                </span>
              </div>
            </div>
            <div className="next-storage-option p-6 [&_+_.next-storage-option]:border-t [&_+_.next-storage-option]:bg-[color-mix(in_oklch,_var(--muted)_45%,_var(--background))] [&_>_p]:text-[12px] [&_>_p]:leading-[1.7] [&_>_p]:mt-4 [&_>_p]:max-w-107.5 max-[1051px]:p-5">
              <div className="next-storage-title flex items-center gap-3 [&_>_svg]:w-7.75 [&_>_svg]:h-7.75 [&_h3]:text-[14px] [&_h3]:font-medium [&_h3]:flex-1 [&_>_span]:pt-1 [&_>_span]:pr-1.75 [&_>_span]:pb-1 [&_>_span]:pl-1.75 [&_>_span]:text-[9px] [&_>_span]:border [&_>_span]:text-muted-foreground [&_>_span]:whitespace-nowrap [&_.next-cloudflare]:text-[#f38020] max-[481px]:gap-2.5 max-[481px]:[&_>_svg]:w-6.75 max-[481px]:[&_>_svg]:h-6.75 max-[481px]:[&_h3]:text-[13px] max-[481px]:[&_>_span]:text-[8px] max-[481px]:[&_>_span]:pt-1 max-[481px]:[&_>_span]:pr-1.25 max-[481px]:[&_>_span]:pb-1 max-[481px]:[&_>_span]:pl-1.25">
                <CloudflareLogo className="next-cloudflare" />
                <h3>On your own instance</h3>
                <span>Self-hosted</span>
              </div>
              <p className="text-muted-foreground">
                Run svgw on your own Cloudflare account for remote drafts, versions, and published
                projects.
              </p>
              <div className="next-storage-details flex flex-wrap gap-3.75 text-muted-foreground text-[10px] mt-4.25 [&_>_span]:inline-flex [&_>_span]:items-center [&_>_span]:gap-1.5 [&_svg]:w-3 [&_svg]:h-3 max-[481px]:gap-3 max-[481px]:text-[9px]">
                <span>
                  <CheckIcon />
                  Remote storage
                </span>
                <span>
                  <CheckIcon />
                  Versions & publishing
                </span>
              </div>
            </div>
          </div>
        </section>

        {projects}

        <div className="next-technology flex items-center justify-center flex-wrap gap-9 text-muted-foreground text-[11px] py-6.5 border-t [&_>_span]:inline-flex [&_>_span]:items-center [&_>_span]:gap-2 [&_>_a]:inline-flex [&_>_a]:items-center [&_>_a]:gap-2 [&_svg]:w-4 [&_svg]:h-4 [&_a:hover]:text-foreground max-[761px]:gap-5 max-[481px]:[justify-content:flex-start] max-[481px]:gap-4.5 max-[481px]:py-6 max-[481px]:text-[10px] max-[481px]:[&_svg]:w-3.5 max-[481px]:[&_svg]:h-3.5 next-container w-[min(1120px,_calc(100%_-_80px))] mx-auto max-[761px]:w-[calc(100%_-_40px)]">
          <span>
            <ReactLogo />
            Built with React
          </span>
          <span>
            <CloudflareLogo />
            Self-host with Cloudflare
          </span>
          <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
            <GitHubLogo />
            Open source on GitHub
          </a>
        </div>
      </main>

      <footer className="next-footer flex items-center justify-between gap-7.5 border-t pt-8 pb-9.5 [&_.next-brand]:text-[18px] max-[481px]:flex-wrap max-[481px]:gap-6.25 max-[481px]:py-7 next-container w-[min(1120px,_calc(100%_-_80px))] mx-auto max-[761px]:w-[calc(100%_-_40px)]">
        <a
          href="/landing-next"
          className="next-brand inline-flex items-center gap-2.5 text-[21px] font-semibold tracking-[-.045em] max-[481px]:gap-2 max-[481px]:text-[18px]"
          aria-label="svgw home"
        >
          <Logo className="size-7" />
          <span>svgw.</span>
        </a>
        <div className="next-maker text-center [&_p]:text-[13px] [&_p]:leading-[1.5] [&_p_>_a]:text-foreground [&_>_div]:flex [&_>_div]:items-center [&_>_div]:justify-center [&_>_div]:gap-4 [&_>_div]:mt-1.75 [&_>_div]:text-muted-foreground [&_>_div]:text-[11px] [&_>_div_>_a]:inline-flex [&_>_div_>_a]:items-center [&_>_div_>_a]:gap-1.25 [&_svg]:w-3 [&_svg]:h-3 [&_a:hover]:underline [&_a:hover]:underline-offset-4 max-[481px]:order-3 max-[481px]:w-full max-[481px]:text-left max-[481px]:[&_>_div]:[justify-content:flex-start]">
          <p className="text-muted-foreground">
            Made by{' '}
            <a href={WEBSITE_URL} target="_blank" rel="noopener noreferrer">
              Raul Carini
            </a>
          </p>
          <div>
            <a href={WEBSITE_URL} target="_blank" rel="noopener noreferrer">
              raulcarini.dev
            </a>
            <a href={AUTHOR_GITHUB_URL} target="_blank" rel="noopener noreferrer">
              <GitHubLogo />
              GitHub
            </a>
          </div>
        </div>
        <a
          href={REPOSITORY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="next-footer-source inline-flex items-center gap-2 text-[11px] text-muted-foreground [&_>_svg]:w-3.25 [&_>_svg]:h-3.25 hover:text-foreground max-[481px]:ml-auto"
        >
          Project source
          <ArrowRightIcon />
        </a>
      </footer>
      <input
        ref={fileInput}
        type="file"
        accept=".svg,image/svg+xml"
        aria-label="Import an SVG"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onImport(file)
        }}
      />
    </div>
  )
}

function NavigationMenu() {
  const { preference, setPreference } = useTheme()
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="next-menu-trigger h-9.5 gap-1.5 px-2.5 text-[12px] font-normal text-muted-foreground max-[761px]:h-10 max-[481px]:px-2 data-popup-open:[&>svg]:rotate-180 leading-[1.3333333333]"
          />
        }
      >
        <span className="next-menu-desktop max-[761px]:hidden">More</span>
        <span className="next-menu-mobile hidden max-[761px]:inline">Menu</span>
        <ChevronDownIcon className="size-[13px] transition-transform duration-150 ease-[ease] motion-reduce:transition-none" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="next-menu-content w-54 p-1.5 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:[&_*]:animate-none motion-reduce:[&_*]:transition-none"
      >
        <DropdownMenuGroup className="next-menu-mobile-links hidden max-[761px]:block">
          <DropdownMenuLabel className="text-[10px]">Explore</DropdownMenuLabel>
          <DropdownMenuItem className="min-h-9.5 cursor-pointer" render={<Link to="/projects" />}>
            <FolderOpenIcon />
            Projects
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-9.5 cursor-pointer" render={<a href="#self-host" />}>
            <CloudflareLogo />
            Self-host
          </DropdownMenuItem>
          <DropdownMenuSeparator className="mx-0 my-1.25" />
        </DropdownMenuGroup>
        <DropdownMenuItem
          className="min-h-9.5 cursor-pointer"
          render={<a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" />}
        >
          <GitHubLogo />
          Source on GitHub
        </DropdownMenuItem>
        <DropdownMenuSeparator className="mx-0 my-1.25" />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px]">Appearance</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={preference}
            onValueChange={(value) => setPreference(value as ThemePreference)}
          >
            <DropdownMenuRadioItem className="min-h-9.5 cursor-pointer" value="system" closeOnClick>
              <MonitorIcon />
              System
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem className="min-h-9.5 cursor-pointer" value="light" closeOnClick>
              <SunIcon />
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem className="min-h-9.5 cursor-pointer" value="dark" closeOnClick>
              <MoonIcon />
              Dark
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
type Bounds = { x: number; y: number; width: number; height: number }

function InteractiveCanvas({ onCreate, busy }: Pick<LandingProps, 'onCreate' | 'busy'>) {
  const [artwork, setArtwork] = useState<Artwork>('brand')
  const [color, setColor] = useState<string>('#2b2422')
  const [size, setSize] = useState(100)
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const mark = useRef<HTMLDivElement>(null)
  const example =
    playgroundExamples.find((item) => item.artwork === artwork) ?? playgroundExamples[0]

  useLayoutEffect(() => {
    const group = mark.current?.querySelector<SVGGElement>('svg > g')
    if (!group) return
    const box = group.getBBox()
    const ratio = size / 100
    setBounds({
      x: 180 + (box.x - 180) * ratio,
      y: 180 + (box.y - 180) * ratio,
      width: box.width * ratio,
      height: box.height * ratio,
    })
  }, [artwork, size])

  return (
    <div
      className="next-demo min-w-0 border bg-background max-[761px]:w-full max-[761px]:max-w-135 max-[761px]:mx-auto"
      aria-label="Interactive SVG example"
    >
      <div
        className="next-demo-options flex items-stretch p-1.5 gap-1 border-b [&_>_button]:flex-1 [&_>_button]:min-w-0 [&_>_button]:flex [&_>_button]:justify-center [&_>_button]:items-center [&_>_button]:gap-1.5 [&_>_button]:text-[11px] [&_>_button]:pt-2.5 [&_>_button]:pr-1.5 [&_>_button]:pb-2.5 [&_>_button]:pl-1.5 [&_>_button]:border [&_>_button]:border-[transparent] [&_>_button]:text-muted-foreground [&_>_button[aria-pressed=true]]:border-border [&_>_button[aria-pressed=true]]:bg-muted [&_>_button[aria-pressed=true]]:text-foreground [&_>_button:hover]:text-foreground [&_svg]:w-5.75 [&_svg]:h-5.75 max-[1051px]:[&_>_button]:px-0.75 max-[1051px]:[&_>_button]:gap-1 max-[1051px]:[&_>_button]:text-[10px] max-[761px]:[&_>_button]:gap-1.5 max-[761px]:[&_>_button]:text-[11px] max-[481px]:[&_>_button]:px-1 max-[481px]:[&_>_button_>_span]:hidden max-[481px]:[&_svg]:w-7.5 max-[481px]:[&_svg]:h-7.5"
        role="group"
        aria-label="Choose example artwork"
      >
        {playgroundExamples.map((item) => (
          <button
            type="button"
            key={item.artwork}
            aria-label={item.label + ' SVG'}
            aria-pressed={artwork === item.artwork}
            onClick={() => {
              setArtwork(item.artwork)
              setColor(item.color)
            }}
          >
            <ArtworkMark artwork={item.artwork} color="currentColor" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="next-demo-canvas canvas-dots [--dot-color:#c7d0c1] [--dot-spacing:20px] relative h-88.5 grid place-items-center pt-4.5 overflow-hidden text-[#586052] bg-[#eef2eb] max-[1051px]:h-84.5 max-[481px]:h-77.5">
        <div className="next-demo-file absolute [inset:17px_20px_auto] flex justify-between gap-3 text-[11px] [&_>_span:last-child]:text-[#6a7363] max-[481px]:[inset:15px_16px_auto] max-[481px]:text-[10px]">
          <span>{example.label.toLowerCase() + '.svg'}</span>
          <span>480 × 480</span>
        </div>
        <div
          ref={mark}
          className="next-mark relative w-[min(340px,_79%)] [&_>_svg]:w-full [&_>_svg]:block [&_.next-selection]:absolute [&_.next-selection]:inset-0 [&_.next-selection]:pointer-events-none max-[481px]:w-[min(288px,_90%)]"
        >
          <ArtworkMark artwork={artwork} color={color} size={size} />
          {bounds && (
            <svg viewBox="0 0 360 360" className="next-selection" aria-hidden="true">
              <rect
                x={bounds.x}
                y={bounds.y}
                width={bounds.width}
                height={bounds.height}
                fill="none"
                stroke="#4c67b1"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              {[
                [bounds.x, bounds.y],
                [bounds.x + bounds.width, bounds.y],
                [bounds.x, bounds.y + bounds.height],
                [bounds.x + bounds.width, bounds.y + bounds.height],
              ].map(([x, y], i) => (
                <rect
                  key={i}
                  x={x - 3}
                  y={y - 3}
                  width="6"
                  height="6"
                  fill="#fff"
                  stroke="#4c67b1"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          )}
        </div>
        <span className="next-demo-hint absolute bottom-4 text-[10px] text-[#636d5d] max-[481px]:text-[9px] max-[481px]:bottom-3.75">
          Adjust the fill and size, then open it in the editor.
        </span>
      </div>
      <div className="next-demo-controls flex items-center justify-between gap-6 pt-4.5 pr-5 pb-4.5 pl-5 border-t max-[1051px]:flex-wrap max-[1051px]:gap-4.5 max-[761px]:flex-nowrap max-[481px]:grid max-[481px]:grid-cols-1 max-[481px]:gap-4.5 max-[481px]:pt-4.5 max-[481px]:pr-5 max-[481px]:pb-4.5 max-[481px]:pl-5">
        <div className="next-fill flex items-center gap-3 text-[11px] [&_>_span]:text-muted-foreground [&_>_div]:flex [&_>_div]:gap-2 [&_button]:w-6.25 [&_button]:h-6.25 [&_button]:rounded-full [&_button]:grid [&_button]:place-items-center [&_button]:border-2 [&_button]:border-[transparent] [&_button]:bg-clip-padding [&_button[aria-pressed=true]]:outline-1 [&_button[aria-pressed=true]]:outline-solid [&_button[aria-pressed=true]]:outline-muted-foreground [&_button[aria-pressed=true]]:outline-offset-2 [&_button:focus-visible]:outline-2! [&_button:focus-visible]:outline-solid [&_button:focus-visible]:outline-foreground! [&_button:focus-visible]:outline-offset-4! [&_button_>_svg]:w-3 [&_button_>_svg]:h-3 [&_button_>_svg]:text-white [&_button[aria-label='Orange_fill']_>_svg]:text-[#2b2422] max-[481px]:justify-between max-[481px]:text-[12px] max-[481px]:[&_>_div]:gap-2.5 max-[481px]:[&_button]:w-6.75 max-[481px]:[&_button]:h-6.75">
          <span>Fill</span>
          <div role="group" aria-label="Artwork fill">
            {palettes.map((palette) => (
              <button
                key={palette.name}
                type="button"
                aria-label={palette.name + ' fill'}
                aria-pressed={color === palette.color}
                style={{ backgroundColor: palette.color }}
                onClick={() => setColor(palette.color)}
              >
                {color === palette.color && <CheckIcon />}
              </button>
            ))}
          </div>
        </div>
        <div className="next-size flex items-center gap-3 text-[11px] [&_>_label]:text-muted-foreground min-w-0 [&_input]:w-22 [&_input]:min-w-0 [&_input]:accent-foreground [&_input]:cursor-pointer [&_output]:w-8.75 [&_output]:text-right [&_output]:tabular-nums max-[481px]:justify-between max-[481px]:text-[12px] max-[481px]:[&_input]:flex-1 max-[481px]:[&_input]:w-auto max-[481px]:[&_input]:ml-3">
          <label htmlFor="next-mark-size">Size</label>
          <input
            id="next-mark-size"
            type="range"
            min="45"
            max="125"
            step="5"
            value={size}
            aria-valuetext={size + '%'}
            onChange={(event) => setSize(Number(event.target.value))}
          />
          <output htmlFor="next-mark-size">{size}%</output>
        </div>
      </div>
      <Button
        className="next-demo-open flex items-center justify-between w-full h-12 px-5 text-[12px] border-0 [&_>_svg]:w-4 [&_>_svg]:h-4 leading-[1.3333333333]"
        disabled={busy}
        onClick={() => onCreate(artworkSvg(artwork, color, size), example.label + ' icon')}
      >
        Open this SVG
        <ArrowRightIcon />
      </Button>
    </div>
  )
}
