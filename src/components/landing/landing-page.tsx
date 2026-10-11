import { useRef, useState, type ReactNode } from 'react'
import {
  ArrowDownIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleIcon,
  CodeXmlIcon,
  DownloadIcon,
  EyeIcon,
  FileUpIcon,
  FolderOpenIcon,
  HandIcon,
  LayersIcon,
  LockKeyholeIcon,
  MinusIcon,
  MonitorIcon,
  MoonIcon,
  MousePointer2Icon,
  PenToolIcon,
  PlusIcon,
  Redo2Icon,
  SparklesIcon,
  SquareIcon,
  SunIcon,
  Undo2Icon,
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

export const designs = ['showcase', 'playground', 'editorial'] as const
export type LandingDesign = (typeof designs)[number]

interface LandingProps {
  design: LandingDesign
  onDesignChange: (design: LandingDesign) => void
  showDesignSwitcher: boolean
  onCreate: (svg?: string, name?: string) => void
  onImport: (file: File) => void
  busy: boolean
  projects: ReactNode
}

export function LandingPage({
  design,
  onDesignChange,
  showDesignSwitcher,
  onCreate,
  onImport,
  busy,
  projects,
}: LandingProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const importFile = () => fileInput.current?.click()
  const actions = { onCreate, onImport: importFile, busy }

  return (
    <div
      className={`landing min-h-dvh text-foreground bg-background pb-0 [&_svg]:shrink-0 [&_button]:[-webkit-tap-highlight-color:transparent] [&_a]:[-webkit-tap-highlight-color:transparent] [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-solid [&_button:focus-visible]:outline-ring [&_button:focus-visible]:outline-offset-5 [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-solid [&_a:focus-visible]:outline-ring [&_a:focus-visible]:outline-offset-5 [&_button:disabled]:opacity-50 [&_button:disabled]:cursor-wait motion-reduce:[&_*]:transition-none! motion-reduce:[&_*]:scroll-auto! motion-reduce:[&_*::before]:transition-none! motion-reduce:[&_*::before]:scroll-auto! motion-reduce:[&_*::after]:transition-none! motion-reduce:[&_*::after]:scroll-auto! landing--${design}${showDesignSwitcher ? ' landing--review pb-19.5' : ''}`}
    >
      <a
        className="landing-skip fixed top-[-60px] left-4 z-100 p-3 bg-background focus:top-3"
        href="#main"
      >
        Skip to content
      </a>
      <header className="landing-nav h-19 w-[min(1200px,_calc(100%_-_80px))] mx-auto flex items-center gap-10.5 border-b max-[1051px]:gap-8 max-[761px]:w-[calc(100%_-_40px)] max-[761px]:h-17 max-[761px]:gap-3.5 max-[481px]:gap-2.5 max-[481px]:[&_.landing-brand]:gap-2 max-[481px]:[&_.landing-brand]:text-[18px] max-[481px]:[&_.landing-brand_>_svg]:w-7 max-[481px]:[&_.landing-brand_>_svg]:h-7">
        <a
          href="/"
          className="landing-brand inline-flex items-center gap-2.5 text-[21px] font-semibold tracking-[-.045em] max-[761px]:text-[19px]"
          aria-label="svgw home"
        >
          <Logo className="size-8" />
          <span>
            svgw<span className="brand-period text-muted-foreground">.</span>
          </span>
        </a>
        <nav
          aria-label="Main navigation"
          className="landing-nav-links flex items-center gap-7 text-[13px] text-muted-foreground [&_a]:inline-flex [&_a]:items-center [&_a]:min-h-10 [&_a:hover]:text-foreground max-[761px]:hidden"
        >
          <a href="#projects">Projects</a>
          <a href="#self-host">Self-host</a>
        </nav>
        <div className="landing-nav-actions flex items-center gap-5 ml-auto max-[761px]:gap-2 max-[481px]:gap-2">
          <LandingMenu />
          <Button
            disabled={busy}
            onClick={() => onCreate()}
            className="nav-open h-9.5 px-4 text-[12px] gap-3 max-[761px]:h-10 max-[761px]:text-[12px] max-[761px]:px-3 max-[481px]:px-2.5 max-[481px]:gap-2 max-[481px]:[&_>_svg]:w-3.5 max-[481px]:[&_>_svg]:h-3.5 leading-[1.3333333333]"
          >
            Open editor
            <ArrowRightIcon className="size-4 max-[481px]:size-3.5" />
          </Button>
        </div>
      </header>

      <main id="main">
        {design === 'showcase' && <Showcase {...actions} />}
        {design === 'playground' && <Playground {...actions} />}
        {design === 'editorial' && <Editorial {...actions} />}
        <OpenSource />
        {projects}
      </main>

      <footer className="landing-footer flex justify-between items-center gap-6.25 py-7 text-muted-foreground text-[10px] [&_.landing-brand]:text-[14px] [&_.landing-brand]:text-foreground max-[481px]:flex-wrap max-[481px]:gap-4 max-[481px]:[&_>_span]:order-3 max-[481px]:[&_>_span]:w-full landing-container w-[min(1120px,_calc(100%_-_80px))] mx-auto max-[761px]:w-[calc(100%_-_40px)]">
        <a
          href="/"
          className="landing-brand inline-flex items-center gap-2.5 text-[21px] font-semibold tracking-[-.045em] max-[761px]:text-[19px]"
        >
          <Logo className="size-6" />
          <span>svgw</span>
        </a>
        <span>Free to use. Open source. Yours to host.</span>
        <div className="landing-footer-links flex items-center gap-5 [&_>_a]:inline-flex [&_>_a]:items-center [&_>_a]:gap-1.75 [&_svg]:w-3 [&_svg]:h-3 [&_>_a:last-child_svg]:transform-[rotate(-90deg)] [&_a:hover]:text-foreground max-[481px]:gap-3.5">
          <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
            <GitHubLogo />
            Source code
          </a>
          <a href="#main">
            Back to top
            <ArrowRightIcon />
          </a>
        </div>
      </footer>

      {showDesignSwitcher && (
        <div
          className="design-switcher fixed bottom-4.5 left-[50%] transform-[translateX(-50%)] z-40 flex items-center gap-1 p-1.25 bg-popover border shadow-[0_4px_20px_rgb(0_0_0_/_.12)] rounded-[8px] whitespace-nowrap [&_>_button]:flex [&_>_button]:items-center [&_>_button]:justify-center [&_>_button]:gap-1.75 [&_>_button]:text-[11px] [&_>_button]:pt-2 [&_>_button]:pr-3 [&_>_button]:pb-2 [&_>_button]:pl-3 [&_>_button]:rounded-[4px] [&_>_button]:transition-[background] [&_>_button]:duration-150 [&_>_button]:ease-[ease] [&_>_button_>_span]:[font-family:monospace] [&_>_button_>_span]:text-[9px] [&_>_button_>_span]:opacity-60 [&_>_button:hover]:bg-muted [&_>_button[aria-pressed=true]]:bg-primary [&_>_button[aria-pressed=true]]:text-primary-foreground max-[481px]:bottom-3 max-[481px]:gap-0.75 max-[481px]:[&_>_button]:text-[10px] max-[481px]:[&_>_button]:px-2.5 max-[481px]:[&_>_button]:gap-1.5"
          role="group"
          aria-label="Landing page designs"
        >
          <span className="design-switcher-label text-[8px] tracking-[.075em] text-muted-foreground pl-2.25 pr-3.25 max-[761px]:hidden">
            EXPLORE DESIGNS
          </span>
          {designs.map((item, index) => (
            <button
              key={item}
              type="button"
              aria-pressed={design === item}
              onClick={() => onDesignChange(item)}
            >
              <span>0{index + 1}</span>
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      )}
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

function LandingMenu() {
  const { preference, setPreference } = useTheme()
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="landing-menu-trigger h-9.5 gap-1.5 px-2.5 text-[12px] font-normal text-muted-foreground max-[761px]:h-10 max-[481px]:px-2 data-popup-open:[&>svg]:rotate-180 leading-[1.3333333333]"
          />
        }
      >
        <span className="landing-menu-label-desktop max-[761px]:hidden">More</span>
        <span className="landing-menu-label-mobile hidden max-[761px]:inline">Menu</span>
        <ChevronDownIcon className="size-[13px] transition-transform duration-150 ease-[ease] motion-reduce:transition-none" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        className="landing-menu-content w-54 p-1.5 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:[&_*]:animate-none motion-reduce:[&_*]:transition-none"
      >
        <DropdownMenuGroup className="landing-menu-mobile-links hidden max-[761px]:block">
          <DropdownMenuLabel className="text-[10px] tracking-[.04em]">Explore</DropdownMenuLabel>
          <DropdownMenuItem className="min-h-9.5 cursor-pointer" render={<a href="#projects" />}>
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
          <ArrowRightIcon className="landing-menu-external ml-auto size-3 -rotate-45 text-muted-foreground" />
        </DropdownMenuItem>
        <DropdownMenuSeparator className="mx-0 my-1.25" />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] tracking-[.04em]">Appearance</DropdownMenuLabel>
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
type Actions = Pick<LandingProps, 'onCreate' | 'busy'> & { onImport: () => void }

function StartActions({ onCreate, onImport, busy }: Actions) {
  return (
    <div className="landing-start-actions flex items-center flex-wrap gap-2.5">
      <Button
        disabled={busy}
        onClick={() => onCreate()}
        className="landing-cta h-11.25 px-5 text-[13px] gap-4 max-[481px]:h-10.5 max-[481px]:text-[12px] max-[481px]:px-4 max-[481px]:gap-2.5 leading-[1.3333333333]"
      >
        Start creating
        <ArrowRightIcon />
      </Button>
      <Button
        variant="outline"
        disabled={busy}
        onClick={onImport}
        className="landing-cta h-11.25 px-5 text-[13px] gap-4 max-[481px]:h-10.5 max-[481px]:text-[12px] max-[481px]:px-4 max-[481px]:gap-2.5 leading-[1.3333333333]"
      >
        <UploadIcon />
        Open an SVG
      </Button>
    </div>
  )
}

function Showcase(actions: Actions) {
  return (
    <>
      <section className="showcase-hero relative pt-18.75 overflow-hidden max-[761px]:pt-15 max-[481px]:pt-11.5">
        <div
          className="showcase-grid canvas-grid absolute [inset:0_0_90px] opacity-55 pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="showcase-decoration absolute w-27 text-[color-mix(in_oklch,_var(--muted-foreground)_35%,_var(--background))] text-center [&_>_svg]:w-full [&_>_span]:inline-block [&_>_span]:[font-family:monospace] [&_>_span]:text-[9px] [&_>_span]:mt-1.5 [&_>_span]:text-muted-foreground max-[1051px]:w-18.75 max-[761px]:hidden decoration-one top-31 left-[max(30px,_calc(50%_-_536px))] transform-[rotate(-14deg)] max-[1051px]:top-25 max-[1051px]:left-6.25"
          aria-hidden="true"
        >
          <ArtworkMark artwork="orbit" color="currentColor" />
          <span>orbit.svg</span>
        </div>
        <div
          className="showcase-decoration absolute w-27 text-[color-mix(in_oklch,_var(--muted-foreground)_35%,_var(--background))] text-center [&_>_svg]:w-full [&_>_span]:inline-block [&_>_span]:[font-family:monospace] [&_>_span]:text-[9px] [&_>_span]:mt-1.5 [&_>_span]:text-muted-foreground max-[1051px]:w-18.75 max-[761px]:hidden decoration-two top-54 right-[max(30px,_calc(50%_-_540px))] transform-[rotate(14deg)] max-[1051px]:top-67.5 max-[1051px]:right-5"
          aria-hidden="true"
        >
          <ArtworkMark color="currentColor" />
          <span>bloom.svg</span>
        </div>
        <div className="showcase-hero-copy relative z-1 text-center [&_h1]:mt-6 [&_h1]:text-[clamp(48px,_6.3vw,_80px)] [&_h1]:leading-[1.05] [&_h1_>_span]:text-muted-foreground [&_>_p]:mt-6 [&_>_p]:text-[16px] [&_.landing-start-actions]:justify-center [&_.landing-start-actions]:mt-6.75 [&_.landing-fineprint]:justify-center [&_.landing-fineprint]:mt-3.75 min-[1500px]:[&_h1]:text-[88px] max-[761px]:px-5 max-[761px]:[&_h1]:text-[clamp(42px,_8vw,_59px)] max-[761px]:[&_>_p]:text-[14px] max-[481px]:[&_h1]:text-[43px] max-[481px]:[&_h1]:mt-5 max-[481px]:[&_>_p]:text-[13px] max-[481px]:[&_>_p]:mt-5 max-[481px]:[&_.landing-fineprint]:text-[10px]">
          <span className="landing-eyebrow inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[.12em] leading-[1.5] text-muted-foreground [&_>_svg]:w-3.5 [&_>_svg]:h-3.5 max-[481px]:text-[9px]">
            <span className="status-dot inline-block w-1.25 h-1.25 rounded-full bg-muted-foreground shrink-0" />{' '}
            A SMALL SPACE FOR BIG IDEAS
          </span>
          <h1 className="font-medium tracking-[-.055em]">
            Your SVGs.
            <br />
            <span>A little more possible.</span>
          </h1>
          <p className="text-muted-foreground leading-[1.65]">
            A focused workspace to draw, edit, and polish your vectors.
            <br className="desktop-break max-[481px]:hidden" /> Right in your browser. Right where
            you need it.
          </p>
          <StartActions {...actions} />
          <div className="landing-fineprint flex items-center flex-wrap gap-1.75 text-[11px] text-muted-foreground [&_svg]:w-3 [&_svg]:h-3 [&_>_span]:mx-1.25">
            <CheckIcon />
            No account needed<span>·</span>
            <CheckIcon />
            Saved on your device
          </div>
        </div>
        <div className="showcase-preview relative mt-13.75 max-[761px]:mt-10 landing-container w-[min(1120px,_calc(100%_-_80px))] mx-auto max-[761px]:w-[calc(100%_-_40px)]">
          <EditorPreview onCreate={actions.onCreate} busy={actions.busy} />
          <div className="preview-caption flex justify-between items-center gap-5 mt-4.5 text-[10px] text-muted-foreground [&_>_span]:inline-flex [&_>_span]:items-center [&_>_span]:gap-1.75 [&_>_span:first-child]:text-[9px] [&_>_span:first-child]:tracking-[.1em] [&_svg]:w-3 [&_svg]:h-3 max-[761px]:[&_>_span:first-child]:text-[8px] max-[761px]:[&_>_span:last-child]:text-[9px] max-[481px]:gap-2.5 max-[481px]:mt-3.25 max-[481px]:[&_>_span:last-child]:text-[8px] max-[481px]:[&_>_span:first-child]:text-[7px] max-[481px]:[&_>_span:first-child]:tracking-[.04em] max-[481px]:[&_.status-dot]:hidden">
            <span>
              <span className="status-dot inline-block w-1.25 h-1.25 rounded-full bg-muted-foreground shrink-0" />{' '}
              REAL VECTORS. REAL POSSIBILITIES.
            </span>
            <span>
              Go on. Try a different color.
              <ArrowDownIcon />
            </span>
          </div>
        </div>
      </section>

      <section
        id="workflow"
        className="showcase-workflow pt-27.5 pb-23.75 max-[761px]:py-17.5 landing-container w-[min(1120px,_calc(100%_-_80px))] mx-auto max-[761px]:w-[calc(100%_-_40px)]"
      >
        <div className="section-intro [&_h2]:mt-4.5 [&_h2]:text-[42px] [&_h2]:leading-[1.12] [&_>_p]:mt-4 [&_>_p]:text-[14px] max-[761px]:[&_h2]:text-[35px] max-[481px]:[&_h2]:text-[34px]">
          <span className="landing-eyebrow inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[.12em] leading-[1.5] text-muted-foreground [&_>_svg]:w-3.5 [&_>_svg]:h-3.5 max-[481px]:text-[9px]">
            FROM IDEA TO .SVG
          </span>
          <h2 className="font-medium tracking-[-.055em]">
            Less in the way.
            <br />
            More in the making.
          </h2>
          <p className="text-muted-foreground leading-[1.65]">
            The tools you reach for, in a space that stays out of your way.
          </p>
        </div>
        <div className="workflow-columns grid grid-cols-3 mt-12.5 max-[761px]:mt-7.5 max-[481px]:grid-cols-1 max-[481px]:gap-6.5">
          <Feature number="01" icon={<FileUpIcon />} title="Bring your own vectors">
            Open an SVG you already have, or start fresh. Your artwork stays editable, from the
            first path to the final export.
          </Feature>
          <Feature number="02" icon={<PenToolIcon />} title="Get every detail right">
            Draw shapes and paths. Work with layers, adjust colors, and line things up with rulers
            and snapping guides.
          </Feature>
          <Feature number="03" icon={<DownloadIcon />} title="Leave with a lighter file">
            Download your SVG, or optimize it with SVGO. Your editable original stays right where
            you left it.
          </Feature>
        </div>
      </section>
    </>
  )
}

function Playground(actions: Actions) {
  const [artwork, setArtwork] = useState<Artwork>('brand')
  const [color, setColor] = useState<string>('#2b2422')
  const example =
    playgroundExamples.find((item) => item.artwork === artwork) ?? playgroundExamples[0]
  return (
    <>
      <section className="playground-hero grid grid-cols-2 items-center gap-17.5 pt-21.25 pb-21.25 max-[1051px]:gap-8.75 max-[1051px]:py-16.25 max-[761px]:grid-cols-1 max-[761px]:gap-12.5 max-[761px]:pt-13.75 max-[481px]:pt-11.25 max-[481px]:gap-10 landing-container w-[min(1120px,_calc(100%_-_80px))] mx-auto max-[761px]:w-[calc(100%_-_40px)]">
        <div className="playground-copy [&_h1]:mt-6 [&_h1]:text-[clamp(60px,_6.9vw,_88px)] [&_h1]:leading-[1.03] [&_>_p]:mt-8 [&_>_p]:max-w-95 [&_>_p]:text-[15px] [&_>_p]:leading-[1.8] [&_>_p_>_strong]:inline-block [&_>_p_>_strong]:mt-2 [&_>_p_>_strong]:text-foreground [&_>_p_>_strong]:font-normal [&_.landing-start-actions]:mt-7.25 [&_.landing-fineprint]:mt-4.5 max-[1051px]:[&_h1]:text-[clamp(54px,_6.6vw,_70px)] max-[761px]:[&_h1]:text-[80px] max-[761px]:[&_>_p]:max-w-full max-[481px]:[&_h1]:text-[clamp(52px,_16vw,_68px)] max-[481px]:[&_>_p]:text-[14px] max-[481px]:[&_>_p]:mt-6.5">
          <span className="landing-eyebrow inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[.12em] leading-[1.5] text-muted-foreground [&_>_svg]:w-3.5 [&_>_svg]:h-3.5 max-[481px]:text-[9px]">
            <Logo className="size-4" /> OPEN SOURCE. OPEN CANVAS.
          </span>
          <h1 className="font-medium tracking-[-.055em]">
            Less setup.
            <br />
            More{' '}
            <span className="playground-word relative [&_>_svg]:absolute [&_>_svg]:w-[106%] [&_>_svg]:left-[-3%] [&_>_svg]:bottom-[-8px] [&_>_svg]:fill-none [&_>_svg]:stroke-muted-foreground [&_>_svg]:stroke-[2]">
              play
              <svg viewBox="0 0 270 16" aria-hidden="true">
                <path d="M3 12Q125-3 266 8" />
              </svg>
            </span>
            .
          </h1>
          <p className="text-muted-foreground leading-[1.65]">
            A free, open-source workspace to draw, edit, and optimize your SVGs. Your projects stay
            right here, in your browser.
          </p>
          <StartActions {...actions} />
          <div className="landing-fineprint flex items-center flex-wrap gap-1.75 text-[11px] text-muted-foreground [&_svg]:w-3 [&_svg]:h-3 [&_>_span]:mx-1.25">
            <CheckIcon />
            Free to use<span>·</span>
            <CheckIcon />
            Local-only<span>·</span>No account
          </div>
          <a
            className="playground-source-link inline-flex items-center gap-2 mt-5 text-[11px] text-muted-foreground [&_svg]:w-3.25 [&_svg]:h-3.25 hover:text-foreground"
            href="#self-host"
          >
            <GitHubLogo />
            Want remote saving? Host your own.
            <ArrowRightIcon />
          </a>
        </div>
        <div className="playground-demo transform-[rotate(1.5deg)] transition-transform duration-300 ease-[ease] hover:transform-[rotate(0)] focus-within:transform-[rotate(0)] max-[761px]:max-w-125 max-[761px]:w-full max-[761px]:mx-auto max-[481px]:transform-none">
          <div className="playground-demo-heading flex justify-between items-center pb-3.75 text-[9px] text-muted-foreground [&_>_span]:inline-flex [&_>_span]:items-center [&_>_span]:gap-1.75 [&_>_span:first-child]:tracking-[.09em] [&_svg]:w-3 [&_svg]:h-3 max-[1051px]:[&_>_span:last-child]:hidden max-[761px]:[&_>_span:last-child]:inline-flex max-[481px]:[&_>_span:last-child]:text-[8px]">
            <span>
              <span className="status-dot inline-block w-1.25 h-1.25 rounded-full bg-muted-foreground shrink-0" />{' '}
              A LITTLE TEST DRIVE
            </span>
            <span>
              Go ahead, make it yours
              <ArrowDownIcon />
            </span>
          </div>
          <div className="playground-surface canvas-dots [--dot-color:#b4bba7] [--dot-radius:.75px] [--dot-spacing:18px] h-93.5 bg-[#edeedc] relative grid place-items-center border border-[#d8dac9] text-[#536047] max-[761px]:h-87.5 max-[481px]:h-78.75">
            <div
              className="playground-ruler canvas-ruler [--ruler-color:#aeb69d] [--ruler-step:10px] [--ruler-height:5px] absolute [inset:0_0_auto] h-6.5 border-b border-b-[#ccd1ba] flex justify-around items-center text-[8px] [font-family:monospace] bg-[#e6e9d4]"
              aria-hidden="true"
            >
              <span>0</span>
              <span>100</span>
              <span>200</span>
              <span>300</span>
              <span>400</span>
            </div>
            <div className="playground-asset-label absolute top-11 left-4.5 right-4.5 flex justify-between [font-family:monospace] text-[9px]">
              {example.label.toLowerCase()}.svg<span>480 × 480</span>
            </div>
            <div
              className={`playground-artwork relative w-61.25 mt-3.5 [&_>_svg]:w-full [&_>_svg]:block [&_.selection-corners]:[inset:31px] [&.playground-artwork--cloudflare_.selection-corners]:[inset:33%_12.65%_32%] max-[481px]:w-55 max-[481px]:[&_.selection-corners]:[inset:28px] max-[481px]:[&.playground-artwork--cloudflare_.selection-corners]:[inset:33%_12.65%_32%] playground-artwork--${artwork}`}
            >
              <ArtworkMark artwork={artwork} color={color} />
              <SelectionCorners />
            </div>
            <span
              className="playground-cursor absolute right-9.5 bottom-11.25 text-[10px] text-[#f7f5f2] bg-[#286548] pt-1.25 pr-2.25 pb-1.25 pl-2.25 transform-[rotate(-1.5deg)] [&_svg]:absolute [&_svg]:left-[-13px] [&_svg]:top-[-18px] [&_svg]:w-6 [&_svg]:h-6 [&_svg]:fill-[#286548] [&_svg]:stroke-white [&_svg]:stroke-[1.5] max-[481px]:right-6 max-[481px]:bottom-7.5"
              aria-hidden="true"
            >
              <MousePointer2Icon />
              you, probably
            </span>
          </div>
          <div className="playground-controls flex items-center justify-between gap-3.5 border border-t-0 p-3.5 bg-background max-[1051px]:flex-wrap max-[1051px]:p-3 max-[761px]:flex-wrap max-[481px]:gap-2 max-[481px]:pt-2.5 max-[481px]:pr-2 max-[481px]:pb-2.5 max-[481px]:pl-2 max-[481px]:flex-nowrap max-[481px]:[&_.preview-palette]:gap-1.5 max-[481px]:[&_.preview-palette_>_button]:w-4.75 max-[481px]:[&_.preview-palette_>_button]:h-4.75">
            <div
              className="artwork-options flex gap-1 [&_>_button]:flex [&_>_button]:items-center [&_>_button]:gap-1.25 [&_>_button]:pt-1.25 [&_>_button]:pr-1.5 [&_>_button]:pb-1.25 [&_>_button]:pl-1.5 [&_>_button]:text-[10px] [&_>_button]:border [&_>_button]:border-[transparent] [&_svg]:w-5.5 [&_svg]:h-5.5 [&_>_button[aria-pressed=true]]:bg-secondary [&_>_button[aria-pressed=true]]:border-border [&_>_button:hover]:bg-muted max-[481px]:[&_>_button]:p-1 max-[481px]:[&_>_button]:w-8 max-[481px]:[&_>_button]:h-8 max-[481px]:[&_>_button]:justify-center max-[481px]:[&_>_button_>_span]:hidden max-[481px]:[&_svg]:w-6 max-[481px]:[&_svg]:h-6"
              role="group"
              aria-label="Choose example artwork"
            >
              {playgroundExamples.map((item) => (
                <button
                  type="button"
                  key={item.artwork}
                  aria-label={`${item.label} SVG`}
                  title={item.label}
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
            <Palette color={color} onChange={setColor} />
          </div>
          <button
            type="button"
            className="playground-continue flex items-center justify-between w-full pt-4 pr-4.5 pb-4 pl-4.5 bg-primary text-primary-foreground text-[12px] [&_svg]:w-4 [&_svg]:h-4 hover:opacity-85"
            disabled={actions.busy}
            onClick={() => actions.onCreate(artworkSvg(artwork, color), `${example.label} icon`)}
          >
            Keep going in the editor
            <ArrowRightIcon />
          </button>
        </div>
      </section>
      <div
        className="playground-tools-strip flex justify-center items-center gap-14.5 flex-wrap border-y pt-6 pr-7.5 pb-6 pl-7.5 bg-landing-surface text-muted-foreground text-[11px] [&_>_span]:flex [&_>_span]:items-center [&_>_span]:gap-2.5 [&_svg]:w-3.75 [&_svg]:h-3.75 max-[1051px]:gap-7.5 max-[761px]:grid max-[761px]:grid-cols-2 max-[761px]:gap-5 max-[761px]:px-7.5 max-[481px]:text-[10px] max-[481px]:gap-4 max-[481px]:px-5 max-[481px]:[&_>_span]:gap-1.75"
        aria-label="Workspace features"
      >
        <span>
          <PenToolIcon />
          Paths & shapes
        </span>
        <span>
          <LayersIcon />
          Layers that make sense
        </span>
        <span>
          <LockKeyholeIcon />
          Local autosave
        </span>
        <span>
          <SparklesIcon />
          Optimized exports
        </span>
      </div>
      <section
        id="workflow"
        className="playground-workflow py-23.75 max-[761px]:py-16.25 landing-container w-[min(1120px,_calc(100%_-_80px))] mx-auto max-[761px]:w-[calc(100%_-_40px)]"
      >
        <div className="section-intro [&_h2]:mt-4.5 [&_h2]:text-[42px] [&_h2]:leading-[1.12] [&_>_p]:mt-4 [&_>_p]:text-[14px] max-[761px]:[&_h2]:text-[35px] max-[481px]:[&_h2]:text-[34px]">
          <span className="landing-eyebrow inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[.12em] leading-[1.5] text-muted-foreground [&_>_svg]:w-3.5 [&_>_svg]:h-3.5 max-[481px]:text-[9px]">
            ONE SMALL TOOL. THE WHOLE WORKFLOW.
          </span>
          <h2 className="font-medium tracking-[-.055em]">
            A home for your
            <br />
            in-between ideas.
          </h2>
        </div>
        <div className="playground-workflow-grid grid grid-cols-3 gap-7.5 mt-10 max-[761px]:gap-3.75 max-[481px]:grid-cols-1 max-[481px]:gap-8.75 max-[481px]:mt-7.5">
          <div className="playground-feature [&_h3]:text-[16px] [&_h3]:font-medium [&_h3]:tracking-[-.02em] [&_h3]:leading-[1.35] [&_>_p]:mt-2.75 [&_>_p]:text-[13px] max-[761px]:[&_h3]:text-[14px] max-[761px]:[&_>_p]:text-[12px] max-[481px]:[&_h3]:text-[17px] max-[481px]:[&_>_p]:text-[13px]">
            <div
              className="feature-visual h-42.5 flex items-center justify-center bg-landing-surface border mb-5.75 max-[761px]:h-35 max-[481px]:h-42.5 max-[481px]:mb-4.5 path-visual [&_svg]:w-[90%] [&_svg]:fill-none [&_svg]:stroke-foreground [&_svg]:stroke-[2] [&_.path-handle]:stroke-muted-foreground [&_.path-handle]:stroke-[1] [&_rect]:fill-background [&_rect]:stroke-foreground [&_rect]:stroke-[1]"
              aria-hidden="true"
            >
              <svg viewBox="0 0 300 150">
                <path d="M35 108C95 108 85 36 150 36S215 108 270 75" />
                <path className="path-handle" d="M85 36H215M95 108H35M240 90L270 75" />
                {[
                  [35, 108],
                  [85, 36],
                  [150, 36],
                  [215, 36],
                  [270, 75],
                ].map(([x, y]) => (
                  <rect key={`${x}-${y}`} x={x - 3} y={y - 3} width="6" height="6" />
                ))}
              </svg>
            </div>
            <h3>A few points. A thousand possibilities.</h3>
            <p className="text-muted-foreground leading-[1.65]">
              Draw with the pen tool, shape your curves, and fine-tune the details.
            </p>
          </div>
          <div className="playground-feature [&_h3]:text-[16px] [&_h3]:font-medium [&_h3]:tracking-[-.02em] [&_h3]:leading-[1.35] [&_>_p]:mt-2.75 [&_>_p]:text-[13px] max-[761px]:[&_h3]:text-[14px] max-[761px]:[&_>_p]:text-[12px] max-[481px]:[&_h3]:text-[17px] max-[481px]:[&_>_p]:text-[13px]">
            <div
              className="feature-visual h-42.5 flex items-center justify-center bg-landing-surface border mb-5.75 max-[761px]:h-35 max-[481px]:h-42.5 max-[481px]:mb-4.5 layers-visual flex-col gap-1.75 pt-5 pr-6.25 pb-5 pl-6.25 [&_>_div]:w-full [&_>_div]:flex [&_>_div]:items-center [&_>_div]:gap-2.25 [&_>_div]:bg-background [&_>_div]:border [&_>_div]:pt-2 [&_>_div]:pr-2.5 [&_>_div]:pb-2 [&_>_div]:pl-2.5 [&_>_div]:text-[10px] [&_>_div:nth-child(2)]:transform-[translateX(9px)] [&_svg]:w-3 [&_svg]:h-3 [&_svg]:text-muted-foreground [&_svg:nth-last-child(2)]:ml-auto max-[761px]:pt-3.75 max-[761px]:pr-2 max-[761px]:pb-3.75 max-[761px]:pl-2 max-[761px]:[&_>_div]:px-1.75 max-[481px]:pt-5.5 max-[481px]:pr-8.75 max-[481px]:pb-5.5 max-[481px]:pl-8.75"
              aria-hidden="true"
            >
              {['Details', 'Mark', 'Background'].map((name, i) => (
                <div key={name}>
                  <LayersIcon />
                  <span>{name}</span>
                  <EyeIcon />
                  <span className="layer-index text-muted-foreground [font-family:monospace] text-[8px] max-[761px]:hidden">
                    0{i + 1}
                  </span>
                </div>
              ))}
            </div>
            <h3>A little order for your creative chaos.</h3>
            <p className="text-muted-foreground leading-[1.65]">
              Organize, hide, and lock your layers. Keep every piece in its place.
            </p>
          </div>
          <div className="playground-feature [&_h3]:text-[16px] [&_h3]:font-medium [&_h3]:tracking-[-.02em] [&_h3]:leading-[1.35] [&_>_p]:mt-2.75 [&_>_p]:text-[13px] max-[761px]:[&_h3]:text-[14px] max-[761px]:[&_>_p]:text-[12px] max-[481px]:[&_h3]:text-[17px] max-[481px]:[&_>_p]:text-[13px]">
            <div
              className="feature-visual h-42.5 flex items-center justify-center bg-landing-surface border mb-5.75 max-[761px]:h-35 max-[481px]:h-42.5 max-[481px]:mb-4.5 export-visual flex-col gap-3.75 p-5 [&_>_div]:flex [&_>_div]:items-center [&_>_div]:gap-2.5 [&_>_div]:border [&_>_div]:p-3.75 [&_>_div]:bg-background [&_>_div]:text-[10px] [&_svg]:w-4 [&_svg]:h-4 [&_>_div_svg:last-child]:w-3 [&_>_div_svg:last-child]:text-muted-foreground [&_>_span]:text-[8px] [&_>_span]:tracking-[.12em] [&_>_span]:text-muted-foreground max-[761px]:p-2.5 max-[761px]:[&_>_div]:text-[8px] max-[761px]:[&_>_div]:pt-2.5 max-[761px]:[&_>_div]:pr-1.5 max-[761px]:[&_>_div]:pb-2.5 max-[761px]:[&_>_div]:pl-1.5 max-[761px]:[&_>_div]:gap-1.25 max-[761px]:[&_>_span]:text-[6px] max-[481px]:[&_>_div]:text-[11px] max-[481px]:[&_>_div]:p-4.25 max-[481px]:[&_>_div]:gap-3 max-[481px]:[&_>_span]:text-[8px]"
              aria-hidden="true"
            >
              <div>
                <CodeXmlIcon />
                <span>your-next-idea.svg</span>
                <CheckIcon />
              </div>
              <span>EDITABLE · SCALABLE · YOURS</span>
            </div>
            <h3>Ready for wherever it goes next.</h3>
            <p className="text-muted-foreground leading-[1.65]">
              Export a clean SVG for your website, your app, or your next project.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}

function OpenSource() {
  return (
    <section
      id="self-host"
      className="self-host-section grid grid-cols-2 gap-y-12.5 gap-x-17.5 border-t pt-18.75 pb-7.5 max-[1051px]:gap-10 max-[761px]:grid-cols-1 max-[761px]:pt-13.75 max-[761px]:pb-6.25 max-[761px]:gap-8 landing-container w-[min(1120px,_calc(100%_-_80px))] mx-auto max-[761px]:w-[calc(100%_-_40px)]"
      aria-labelledby="self-host-heading"
    >
      <div className="self-host-copy [&_h2]:mt-5.25 [&_h2]:text-[52px] [&_h2]:leading-[1.06] [&_h2_>_span]:text-muted-foreground [&_>_p]:max-w-107.5 [&_>_p]:mt-5 [&_>_p]:text-[13px] [&_>_p]:leading-[1.8] [&_>_p_+_p]:mt-3.5 max-[1051px]:[&_h2]:text-[46px] max-[761px]:[&_h2]:text-[44px] max-[761px]:[&_>_p]:max-w-full max-[481px]:[&_h2]:text-[39px]">
        <span className="landing-eyebrow inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[.12em] leading-[1.5] text-muted-foreground [&_>_svg]:w-3.5 [&_>_svg]:h-3.5 max-[481px]:text-[9px]">
          <GitHubLogo /> SMALL TOOL. OPEN POSSIBILITIES.
        </span>
        <h2 className="font-medium tracking-[-.055em]" id="self-host-heading">
          Free here.
          <br />
          <span>Yours everywhere.</span>
        </h2>
        <p className="text-muted-foreground leading-[1.65]">
          Use this website for free. Your drafts are saved locally in this browser, and you can
          download your SVGs whenever you like.
        </p>
        <p className="text-muted-foreground leading-[1.65]">
          Want remote saving, version history, and shared projects? Download the source and host
          your own instance. Your storage, your setup, your rules.
        </p>
        <div className="self-host-actions flex items-center flex-wrap gap-4.5 mt-7 [&_.landing-cta]:gap-2.5 [&_svg]:w-3.75 [&_svg]:h-3.75">
          <Button
            className="landing-cta h-11.25 px-5 text-[13px] gap-4 max-[481px]:h-10.5 max-[481px]:text-[12px] max-[481px]:px-4 max-[481px]:gap-2.5 leading-[1.3333333333]"
            render={<a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
          >
            <GitHubLogo className="size-[15px]" />
            Get the source
            <ArrowRightIcon className="size-[15px]" />
          </Button>
          <a
            className="self-host-guide inline-flex items-center gap-1.75 text-[11px] text-muted-foreground hover:text-foreground"
            href={`${REPOSITORY_URL}#cloudflare`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Self-hosting guide
            <ArrowRightIcon />
          </a>
        </div>
      </div>
      <div className="self-host-options border self-start">
        <div className="hosting-option p-6.5 [&_+_.hosting-option]:border-t [&_>_p]:mt-4.5 [&_>_p]:text-[12px] [&_>_p]:leading-[1.75] max-[1051px]:p-5.5 max-[761px]:p-6.25 max-[481px]:p-5">
          <div className="hosting-option-heading flex items-center gap-3.25 [&_>_svg]:w-8 [&_>_svg]:h-8 [&_>_div]:flex-1 [&_>_div_>_span]:text-[8px] [&_>_div_>_span]:tracking-[.1em] [&_>_div_>_span]:text-muted-foreground [&_h3]:mt-1.25 [&_h3]:text-[15px] [&_h3]:leading-[1.35] [&_h3]:font-medium [&_h3]:tracking-[-.02em] [&_>_span]:border [&_>_span]:pt-1 [&_>_span]:pr-1.5 [&_>_span]:pb-1 [&_>_span]:pl-1.5 [&_>_span]:text-[9px] [&_>_span]:text-muted-foreground [&_>_span]:whitespace-nowrap max-[1051px]:gap-2.5 max-[1051px]:[&_h3]:text-[14px] max-[761px]:[&_h3]:text-[16px] max-[481px]:[&_>_svg]:w-7 max-[481px]:[&_>_svg]:h-7 max-[481px]:[&_h3]:text-[14px] max-[481px]:[&_>_span]:text-[8px]">
            <Logo className="size-8" />
            <div>
              <span>THIS WEBSITE</span>
              <h3>A canvas, ready when you are.</h3>
            </div>
            <span className="hosting-badge">Free</span>
          </div>
          <p className="text-muted-foreground leading-[1.65]">
            Open the editor and start making. No account or setup needed.
          </p>
          <div className="hosting-option-detail flex items-center flex-wrap gap-4 mt-4.5 text-[10px] text-muted-foreground [&_>_span]:inline-flex [&_>_span]:items-center [&_>_span]:gap-1.5 [&_svg]:w-3 [&_svg]:h-3 max-[481px]:gap-3">
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
        <div className="hosting-option p-6.5 [&_+_.hosting-option]:border-t [&_>_p]:mt-4.5 [&_>_p]:text-[12px] [&_>_p]:leading-[1.75] max-[1051px]:p-5.5 max-[761px]:p-6.25 max-[481px]:p-5 hosting-option--remote bg-landing-surface">
          <div className="hosting-option-heading flex items-center gap-3.25 [&_>_svg]:w-8 [&_>_svg]:h-8 [&_>_div]:flex-1 [&_>_div_>_span]:text-[8px] [&_>_div_>_span]:tracking-[.1em] [&_>_div_>_span]:text-muted-foreground [&_h3]:mt-1.25 [&_h3]:text-[15px] [&_h3]:leading-[1.35] [&_h3]:font-medium [&_h3]:tracking-[-.02em] [&_>_span]:border [&_>_span]:pt-1 [&_>_span]:pr-1.5 [&_>_span]:pb-1 [&_>_span]:pl-1.5 [&_>_span]:text-[9px] [&_>_span]:text-muted-foreground [&_>_span]:whitespace-nowrap max-[1051px]:gap-2.5 max-[1051px]:[&_h3]:text-[14px] max-[761px]:[&_h3]:text-[16px] max-[481px]:[&_>_svg]:w-7 max-[481px]:[&_>_svg]:h-7 max-[481px]:[&_h3]:text-[14px] max-[481px]:[&_>_span]:text-[8px]">
            <CloudflareLogo className="hosting-cloudflare text-[#f38020]" />
            <div>
              <span>YOUR OWN INSTANCE</span>
              <h3>A workspace on your terms.</h3>
            </div>
            <span className="hosting-badge">Self-hosted</span>
          </div>
          <p className="text-muted-foreground leading-[1.65]">
            Run svgw on your own Cloudflare account to save and manage projects remotely.
          </p>
          <div className="hosting-option-detail flex items-center flex-wrap gap-4 mt-4.5 text-[10px] text-muted-foreground [&_>_span]:inline-flex [&_>_span]:items-center [&_>_span]:gap-1.5 [&_svg]:w-3 [&_svg]:h-3 max-[481px]:gap-3">
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
      <div className="landing-technology col-span-full flex justify-between items-center flex-wrap gap-5.5 border-t pt-6.25 text-muted-foreground [&_>_span]:text-[8px] [&_>_span]:tracking-[.09em] [&_>_div]:flex [&_>_div]:items-center [&_>_div]:flex-wrap [&_>_div]:gap-6.5 [&_>_div]:text-[11px] [&_>_div_>_span]:inline-flex [&_>_div_>_span]:items-center [&_>_div_>_span]:gap-2 [&_a]:inline-flex [&_a]:items-center [&_a]:gap-2 [&_svg]:w-4 [&_svg]:h-4 [&_a_>_svg:last-child]:w-3 [&_a_>_svg:last-child]:h-3 [&_a:hover]:text-foreground max-[761px]:gap-5 max-[761px]:[&_>_div]:gap-y-4.5 max-[761px]:[&_>_div]:gap-x-6 max-[481px]:[&_>_div]:gap-4 max-[481px]:[&_>_div]:text-[10px] max-[481px]:[&_svg]:w-3.5 max-[481px]:[&_svg]:h-3.5">
        <span>SMALL BY DESIGN. OPEN BY NATURE.</span>
        <div>
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
            <ArrowRightIcon />
          </a>
        </div>
      </div>
    </section>
  )
}

function Editorial(actions: Actions) {
  return (
    <>
      <section className="editorial-hero pt-10 max-[481px]:pt-7.5 landing-container w-[min(1120px,_calc(100%_-_80px))] mx-auto max-[761px]:w-[calc(100%_-_40px)]">
        <div className="editorial-kicker flex justify-between items-center [&_>_span:last-child]:text-muted-foreground [&_>_span:last-child]:text-[9px] [&_>_span:last-child]:tracking-[.07em] max-[761px]:[&_>_span:last-child]:hidden">
          <span className="landing-eyebrow inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[.12em] leading-[1.5] text-muted-foreground [&_>_svg]:w-3.5 [&_>_svg]:h-3.5 max-[481px]:text-[9px]">
            THE SMALL, USEFUL SVG WORKSPACE
          </span>
          <span>BUILT FOR THE BROWSER ↗</span>
        </div>
        <div className="editorial-headline flex items-end justify-between pt-8.25 [&_h1]:text-[clamp(75px,_9.8vw,_128px)] [&_h1]:leading-[.97] [&_h1]:font-normal [&_h1_>_span]:relative [&_h1_>_span]:text-muted-foreground [&_h1_svg]:absolute [&_h1_svg]:w-full [&_h1_svg]:left-0 [&_h1_svg]:bottom-[-5px] [&_h1_svg]:fill-none [&_h1_svg]:stroke-muted-foreground [&_h1_svg]:stroke-[1.5] max-[1051px]:[&_h1]:text-[104px] max-[761px]:[&_h1]:text-[86px] max-[481px]:pt-6 max-[481px]:[&_h1]:text-[clamp(60px,_15vw,_74px)]">
          <h1 className="font-medium tracking-[-.055em]">
            Good things
            <br />
            take{' '}
            <span>
              shape
              <svg viewBox="0 0 410 24" aria-hidden="true">
                <path d="M4 15Q195 2 405 12" />
              </svg>
            </span>
            .
          </h1>
          <div className="editorial-hero-aside flex flex-col items-center gap-2.5 pt-0 pr-8.75 pb-1 pl-8.75 [&_>_svg]:w-28 [&_>_svg]:h-28 [&_>_span]:text-center [&_>_span]:text-[8px] [&_>_span]:leading-[1.8] [&_>_span]:tracking-[.13em] [&_>_span]:text-muted-foreground max-[761px]:px-0 max-[761px]:[&_>_svg]:w-17.5 max-[761px]:[&_>_svg]:h-17.5 max-[481px]:hidden">
            <ArtworkMark artwork="orbit" color="currentColor" />
            <span>
              MAKE ROOM
              <br />
              FOR YOUR IDEAS.
            </span>
          </div>
        </div>
        <div className="editorial-hero-bottom flex justify-between items-center gap-6.25 py-9.25 [&_>_p]:text-[14px] max-[761px]:flex-wrap max-[761px]:gap-5 max-[481px]:py-7.25 max-[481px]:[&_>_p]:text-[13px]">
          <p className="text-muted-foreground leading-[1.65]">
            A quieter place for your vectors.
            <br />
            Open a file. Follow an idea. Make it your own.
          </p>
          <StartActions {...actions} />
        </div>
        <div className="editorial-gallery grid grid-cols-3 gap-3 max-[481px]:grid-cols-2 max-[481px]:gap-2">
          <ArtworkTile
            artwork="bloom"
            name="A mark with personality."
            caption="01 / DRAW SOMETHING"
            color="#286548"
            className="tile-bloom bg-[#e9ecd7] text-[#3f5938]"
            onCreate={actions.onCreate}
            busy={actions.busy}
          />
          <ArtworkTile
            artwork="orbit"
            name="A new perspective."
            caption="02 / EXPLORE A SHAPE"
            color="#f0e4d6"
            className="tile-orbit bg-[#2b2422] text-[#f0e4d6]"
            onCreate={actions.onCreate}
            busy={actions.busy}
          />
          <ArtworkTile
            artwork="logo"
            name="The start of a brand."
            caption="03 / MAKE IT YOURS"
            color="#286548"
            className="tile-logo bg-[#eae7e1] text-[#625c53]"
            onCreate={actions.onCreate}
            busy={actions.busy}
          />
        </div>
      </section>
      <section
        id="workflow"
        className="editorial-workflow pt-24 pb-17.5 max-[761px]:pt-16.25 landing-container w-[min(1120px,_calc(100%_-_80px))] mx-auto max-[761px]:w-[calc(100%_-_40px)]"
      >
        <div className="editorial-workflow-heading grid grid-cols-[1fr_1.5fr_1fr] gap-7.5 [align-items:start] mb-10 [&_>_.landing-eyebrow]:pt-1.75 [&_h2]:text-[36px] [&_h2]:leading-[1.12] [&_p]:text-[12px] [&_p]:pt-1.75 max-[761px]:grid-cols-[1fr_1.5fr] max-[761px]:gap-5 max-[761px]:[&_>_p]:hidden max-[481px]:grid-cols-1 max-[481px]:gap-3.75 max-[481px]:mb-6.5 max-[481px]:[&_h2]:text-[34px]">
          <span className="landing-eyebrow inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[.12em] leading-[1.5] text-muted-foreground [&_>_svg]:w-3.5 [&_>_svg]:h-3.5 max-[481px]:text-[9px]">
            A SIMPLE WAY TO WORK
          </span>
          <h2 className="font-medium tracking-[-.055em]">
            From a rough idea
            <br />
            to the right shape.
          </h2>
          <p className="text-muted-foreground leading-[1.65]">
            You bring the idea.
            <br />
            We’ll keep the workspace simple.
          </p>
        </div>
        <div className="editorial-steps [&_>_div]:grid [&_>_div]:grid-cols-[50px_1.05fr_1fr_24px] [&_>_div]:gap-6.25 [&_>_div]:items-center [&_>_div]:border-t [&_>_div]:py-7.25 [&_>_div:last-child]:border-b [&_>_div_>_span]:text-[10px] [&_>_div_>_span]:text-muted-foreground [&_>_div_>_span]:[font-family:monospace] [&_h3]:text-[19px] [&_h3]:font-normal [&_h3]:tracking-[-.02em] [&_p]:text-[12px] [&_p]:max-w-92.5 [&_svg]:w-4.5 [&_svg]:h-4.5 [&_svg]:text-muted-foreground max-[761px]:[&_>_div]:grid-cols-[25px_1fr_1fr_18px] max-[761px]:[&_>_div]:gap-3.75 max-[761px]:[&_h3]:text-[16px] max-[481px]:[&_>_div]:grid-cols-[25px_1fr_18px] max-[481px]:[&_>_div]:gap-3 max-[481px]:[&_>_div]:py-5.75 max-[481px]:[&_h3]:text-[18px] max-[481px]:[&_p]:col-start-2 max-[481px]:[&_p]:text-[12px] max-[481px]:[&_svg]:col-start-3 max-[481px]:[&_svg]:[grid-row:1]">
          <div>
            <span>01</span>
            <h3>Find your starting point.</h3>
            <p className="text-muted-foreground leading-[1.65]">
              Bring an SVG from your favorite design tool, or make a fresh start on a blank canvas.
            </p>
            <UploadIcon />
          </div>
          <div>
            <span>02</span>
            <h3>Make the details yours.</h3>
            <p className="text-muted-foreground leading-[1.65]">
              Work with paths, fills, layers, and guides. A small, familiar set of tools to get it
              just right.
            </p>
            <PenToolIcon />
          </div>
          <div>
            <span>03</span>
            <h3>Take it into the world.</h3>
            <p className="text-muted-foreground leading-[1.65]">
              Export an SVG that scales with your idea. Optimize a copy when every byte matters.
            </p>
            <ArrowRightIcon />
          </div>
        </div>
      </section>
      <section className="editorial-product grid grid-cols-[.8fr_1.2fr] items-center gap-15 pb-25 [&_h2]:text-[32px] [&_h2]:leading-[1.14] [&_h2]:mt-5 [&_p]:text-[13px] [&_p]:mt-4 max-[1051px]:gap-8.75 max-[1051px]:[&_.preview-layers]:hidden max-[1051px]:[&_.preview-body]:grid-cols-[minmax(0,1fr)] max-[761px]:grid-cols-1 max-[761px]:gap-7.5 max-[761px]:pb-16.25 max-[761px]:[&_.preview-body]:h-77.5 max-[761px]:[&_.preview-artboard]:w-55 max-[761px]:[&_.preview-artboard]:h-55 landing-container w-[min(1120px,_calc(100%_-_80px))] mx-auto max-[761px]:w-[calc(100%_-_40px)]">
        <div>
          <span className="landing-eyebrow inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[.12em] leading-[1.5] text-muted-foreground [&_>_svg]:w-3.5 [&_>_svg]:h-3.5 max-[481px]:text-[9px]">
            THE SPACE BEHIND THE SHAPES
          </span>
          <h2 className="font-medium tracking-[-.055em]">
            Everything in its place.
            <br />
            Including you.
          </h2>
          <p className="text-muted-foreground leading-[1.65]">
            Your layers on the left. Your properties on the right. Your idea, right in the middle.
          </p>
          <button
            type="button"
            disabled={actions.busy}
            className="landing-text-link inline-flex items-center gap-3.75 border-b pb-1.5 mt-6.25 text-[12px] [&_svg]:w-3.5 [&_svg]:h-3.5"
            onClick={() => actions.onCreate()}
          >
            Step into the workspace
            <ArrowRightIcon />
          </button>
        </div>
        <EditorPreview onCreate={actions.onCreate} busy={actions.busy} compact />
      </section>
    </>
  )
}

function ArtworkTile({
  artwork,
  color,
  name,
  caption,
  className,
  onCreate,
  busy,
}: { artwork: Artwork; color: string; name: string; caption: string; className: string } & Pick<
  LandingProps,
  'onCreate' | 'busy'
>) {
  return (
    <button
      type="button"
      disabled={busy}
      className={`artwork-tile relative flex flex-col items-stretch pt-4.25 pr-5 pb-4.25 pl-5 text-left min-w-0 overflow-hidden border border-[transparent] transition-transform duration-250 ease-[ease] hover:transform-[translateY(-5px)] [&_>_svg]:self-center [&_>_svg]:w-[min(100%,_242px)] [&_>_svg]:my-3.75 [&_>_svg]:transition-transform [&_>_svg]:duration-400 [&_>_svg]:ease-[ease] [&:hover_>_svg]:transform-[rotate(10deg)] max-[761px]:p-3.25 max-[481px]:p-3.25 max-[481px]:[&:last-child]:col-span-2 max-[481px]:[&:last-child]:grid max-[481px]:[&:last-child]:grid-cols-[1fr_140px] max-[481px]:[&:last-child]:items-center max-[481px]:[&:last-child]:gap-x-2.5 max-[481px]:[&:last-child_>_svg]:col-start-2 max-[481px]:[&:last-child_>_svg]:[grid-row:1_/_3] max-[481px]:[&:last-child_>_svg]:w-30 max-[481px]:[&:last-child_>_svg]:m-0 max-[481px]:[&:last-child_>_.tile-topline]:col-start-1 max-[481px]:[&:last-child_>_.tile-topline_>_svg]:hidden max-[481px]:[&:last-child_>_.tile-bottomline]:col-start-1 ${className}`}
      onClick={() => onCreate(artworkSvg(artwork, color), `${capitalize(artwork)} mark`)}
      aria-label={`Edit ${artwork} example`}
    >
      <span className="tile-topline flex items-center justify-between gap-2 text-[8px] tracking-[.05em] [&_>_svg]:w-3.5 [&_>_svg]:h-3.5 max-[761px]:text-[6px] max-[481px]:text-[6px] max-[481px]:tracking-[.02em] max-[481px]:[&_>_svg]:w-2.5 max-[481px]:[&_>_svg]:h-2.5">
        {caption}
        <ArrowRightIcon />
      </span>
      <ArtworkMark artwork={artwork} color={color} />
      <span className="tile-bottomline flex items-center justify-between gap-2 text-[12px] [&_>_span]:[font-family:monospace] [&_>_span]:text-[9px] [&_>_span]:opacity-60 max-[761px]:text-[9px] max-[761px]:[&_>_span]:hidden max-[481px]:text-[10px]">
        {name}
        <span>.svg</span>
      </span>
    </button>
  )
}

function Feature({
  number,
  icon,
  title,
  children,
}: {
  number: string
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <div className="workflow-feature border-t pt-6 pr-8 pb-0 pl-0 [&_+_.workflow-feature]:border-l [&_+_.workflow-feature]:pl-8 [&_h3]:mt-9 [&_h3]:text-[18px] [&_h3]:font-medium [&_h3]:tracking-[-.025em] [&_p]:mt-3 [&_p]:text-[13px] max-[761px]:pr-3.75 max-[761px]:[&_+_.workflow-feature]:pl-3.75 max-[761px]:[&_h3]:text-[15px] max-[761px]:[&_h3]:mt-6.25 max-[761px]:[&_p]:text-[12px] max-[481px]:border-l-0 max-[481px]:pt-5 max-[481px]:pr-0 max-[481px]:pb-0 max-[481px]:pl-0 max-[481px]:[&_+_.workflow-feature]:border-l-0 max-[481px]:[&_+_.workflow-feature]:pt-5 max-[481px]:[&_+_.workflow-feature]:pr-0 max-[481px]:[&_+_.workflow-feature]:pb-0 max-[481px]:[&_+_.workflow-feature]:pl-0 max-[481px]:[&_h3]:mt-4.5 max-[481px]:[&_h3]:text-[17px] max-[481px]:[&_p]:text-[13px]">
      <div className="workflow-feature-top flex items-center justify-between text-muted-foreground text-[11px] [font-family:monospace] [&_svg]:w-4.5 [&_svg]:h-4.5">
        <span>{number}</span>
        {icon}
      </div>
      <h3>{title}</h3>
      <p className="text-muted-foreground leading-[1.65]">{children}</p>
    </div>
  )
}

function Palette({ color, onChange }: { color: string; onChange: (color: string) => void }) {
  return (
    <div
      className="preview-palette flex gap-2 [&_>_button]:w-5.75 [&_>_button]:h-5.75 [&_>_button]:rounded-full [&_>_button]:grid [&_>_button]:place-items-center [&_>_button]:border-2 [&_>_button]:border-[transparent] [&_>_button]:bg-clip-padding [&_>_button]:transition-transform [&_>_button]:duration-150 [&_>_button]:ease-[ease] [&_>_button:hover]:transform-[translateY(-2px)] [&_>_button[aria-pressed=true]]:outline-1 [&_>_button[aria-pressed=true]]:outline-solid [&_>_button[aria-pressed=true]]:outline-muted-foreground [&_>_button[aria-pressed=true]]:outline-offset-2 [&_svg]:w-2.75 [&_svg]:h-2.75 [&_svg]:text-white"
      role="group"
      aria-label="Artwork color"
    >
      {palettes.map((palette) => (
        <button
          type="button"
          key={palette.name}
          style={{ backgroundColor: palette.color }}
          aria-label={`${palette.name} color`}
          aria-pressed={color === palette.color}
          onClick={() => onChange(palette.color)}
        >
          {color === palette.color && <CheckIcon />}
        </button>
      ))}
    </div>
  )
}

function SelectionCorners() {
  return (
    <div
      className="selection-corners absolute [inset:53px] border border-[#54755f] pointer-events-none [&_>_i]:absolute [&_>_i]:w-1.25 [&_>_i]:h-1.25 [&_>_i]:bg-white [&_>_i]:border [&_>_i]:border-[#54755f] [&_>_i:nth-child(1)]:top-[-3px] [&_>_i:nth-child(1)]:left-[-3px] [&_>_i:nth-child(2)]:top-[-3px] [&_>_i:nth-child(2)]:right-[-3px] [&_>_i:nth-child(3)]:bottom-[-3px] [&_>_i:nth-child(3)]:left-[-3px] [&_>_i:nth-child(4)]:bottom-[-3px] [&_>_i:nth-child(4)]:right-[-3px]"
      aria-hidden="true"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  )
}

function EditorPreview({
  onCreate,
  busy,
  compact = false,
}: Pick<LandingProps, 'onCreate' | 'busy'> & { compact?: boolean }) {
  const [color, setColor] = useState<string>(palettes[0].color)
  return (
    <div
      className={`editor-preview bg-background border shadow-[0_8px_32px_rgb(43_36_34_/_.06),_0_2px_5px_rgb(43_36_34_/_.03)] overflow-hidden dark:shadow-[0_8px_32px_rgb(0_0_0_/_.2)] ${compact ? 'editor-preview--compact [&_.preview-body]:grid-cols-[90px_minmax(0,1fr)] [&_.preview-body]:h-71.25 [&_.preview-inspector]:hidden [&_.preview-artboard]:w-47.5 [&_.preview-artboard]:h-47.5 [&_.preview-artboard]:p-5 [&_.selection-corners]:[inset:40px] [&_.preview-toolbar]:gap-2.5 [&_.preview-panel-heading]:gap-0 [&_.preview-panel-heading_>_span]:hidden [&_.preview-layer-row_>_svg:first-child]:hidden [&_.preview-layer-row]:grid-cols-[8px_11px_1fr] [&_.preview-layer-row]:gap-1.25 [&_.preview-layer-row]:px-1.5 [&_.preview-layer-row]:text-[8px] [&_.preview-layer-row_>_span]:hidden [&_.preview-layer-row:nth-child(n+3)]:grid-cols-[11px_1fr] [&_.preview-layer-row:nth-child(n+3)]:pl-4.25 [&_.preview-saved]:hidden [&_.preview-mobile-palette]:block [&_.preview-mobile-palette_.preview-palette]:gap-1.25 [&_.preview-mobile-palette_button]:w-3.5 [&_.preview-mobile-palette_button]:h-3.5 [&_.preview-mobile-palette_button_svg]:w-2 [&_.preview-mobile-palette_button_svg]:h-2 [&_.preview-zoom]:hidden' : ''}`}
      aria-label="Interactive workspace preview"
    >
      <div className="preview-header flex items-center gap-2.5 h-11 border-b pt-0 pr-3 pb-0 pl-3 text-[11px] [&_strong]:text-[12px] [&_>_button]:inline-flex [&_>_button]:items-center [&_>_button]:gap-2.5 [&_>_button]:ml-auto [&_>_button]:pt-1.5 [&_>_button]:pr-2.5 [&_>_button]:pb-1.5 [&_>_button]:pl-2.5 [&_>_button]:text-[10px] [&_>_button]:text-primary-foreground [&_>_button]:bg-primary [&_>_button]:transition-opacity [&_>_button]:duration-150 [&_>_button]:ease-[ease] [&_>_button:hover]:opacity-80 [&_>_button_svg]:w-3 [&_>_button_svg]:h-3 max-[481px]:gap-1.75 max-[481px]:px-2">
        <Logo className="size-5" />
        <strong>svgw</strong>
        <span className="preview-header-divider h-4 w-px bg-border mx-1 max-[481px]:mx-px" />
        <span>bloom.svg</span>
        <span className="preview-saved inline-flex items-center gap-1.25 text-muted-foreground text-[9px] ml-3 [&_svg]:w-2.75 [&_svg]:h-2.75 max-[481px]:hidden">
          <CheckIcon />
          Preview
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => onCreate(artworkSvg('bloom', color), 'Bloom mark')}
        >
          Edit this SVG
          <ArrowRightIcon />
        </button>
      </div>
      <div className="preview-body grid grid-cols-[170px_minmax(0,1fr)_195px] h-97.5 max-[1051px]:grid-cols-[140px_minmax(0,1fr)_170px] max-[1051px]:h-87.5 max-[761px]:grid-cols-[100px_minmax(0,1fr)] max-[761px]:h-81.25 max-[481px]:grid-cols-[minmax(0,1fr)] max-[481px]:h-77.5">
        <aside
          className="preview-layers flex flex-col border-r bg-landing-surface text-[10px] max-[481px]:hidden"
          aria-label="Example layers"
        >
          <div className="preview-panel-heading flex items-center gap-4.5 h-9.75 border-b px-3 [&_strong]:self-stretch [&_strong]:flex [&_strong]:items-center [&_strong]:border-b-2 [&_strong]:border-b-foreground [&_strong]:font-medium [&_>_span]:text-muted-foreground max-[761px]:[&_>_span]:hidden">
            <strong>Layers</strong>
            <span>Projects</span>
          </div>
          <div className="preview-layer-row grid grid-cols-[13px_10px_13px_1fr] items-center gap-2 h-7.5 px-2.5 border-b border-b-[color-mix(in_oklch,_var(--border)_45%,_transparent)] [&_svg]:w-3 [&_svg]:h-3 [&_svg]:text-muted-foreground max-[761px]:grid-cols-[12px_1fr] max-[761px]:gap-1.75 max-[761px]:[&_>_svg:first-child]:hidden max-[761px]:[&_>_span]:hidden max-[761px]:[&:nth-child(2)_>_svg:nth-child(2)]:hidden">
            <EyeIcon />
            <ChevronDownIcon />
            <LayersIcon />
            Bloom
          </div>
          <div className="preview-layer-row grid grid-cols-[13px_10px_13px_1fr] items-center gap-2 h-7.5 px-2.5 border-b border-b-[color-mix(in_oklch,_var(--border)_45%,_transparent)] [&_svg]:w-3 [&_svg]:h-3 [&_svg]:text-muted-foreground max-[761px]:grid-cols-[12px_1fr] max-[761px]:gap-1.75 max-[761px]:[&_>_svg:first-child]:hidden max-[761px]:[&_>_span]:hidden max-[761px]:[&:nth-child(2)_>_svg:nth-child(2)]:hidden preview-layer-selected bg-secondary">
            <EyeIcon />
            <span /> <SparklesIcon />
            Petals
          </div>
          <div className="preview-layer-row grid grid-cols-[13px_10px_13px_1fr] items-center gap-2 h-7.5 px-2.5 border-b border-b-[color-mix(in_oklch,_var(--border)_45%,_transparent)] [&_svg]:w-3 [&_svg]:h-3 [&_svg]:text-muted-foreground max-[761px]:grid-cols-[12px_1fr] max-[761px]:gap-1.75 max-[761px]:[&_>_svg:first-child]:hidden max-[761px]:[&_>_span]:hidden max-[761px]:[&:nth-child(2)_>_svg:nth-child(2)]:hidden">
            <EyeIcon />
            <span />
            <CircleIcon />
            Center
          </div>
          <div className="preview-layer-footer flex justify-between items-center mt-auto pt-2.25 pr-3 pb-2.25 pl-3 border-t text-muted-foreground [&_svg]:w-3 [&_svg]:h-3">
            1 layer
            <PlusIcon />
          </div>
        </aside>
        <div className="preview-canvas canvas-dots relative flex items-center justify-center bg-landing-surface pt-10.75 overflow-hidden">
          <div
            className="preview-ruler canvas-ruler absolute [inset:0_0_auto] h-4.75 flex items-center justify-around [font-family:monospace] text-[7px] text-muted-foreground bg-landing-surface border-b"
            aria-hidden="true"
          >
            <span>0</span>
            <span>100</span>
            <span>200</span>
            <span>300</span>
            <span>400</span>
          </div>
          <div
            className="preview-toolbar absolute flex items-center gap-4.25 top-8 p-1.25 border shadow-[0_2px_4px_rgb(0_0_0_/_.08)] bg-background [&_>_svg]:w-3.5 [&_>_svg]:h-3.5 [&_>_span_svg]:w-3.5 [&_>_span_svg]:h-3.5 [&_>_svg:nth-last-child(-n+2)]:text-muted-foreground [&_.selected]:p-1.5 [&_.selected]:bg-primary [&_.selected]:text-primary-foreground [&_>_i]:w-px [&_>_i]:h-4.25 [&_>_i]:bg-border max-[761px]:gap-3"
            aria-hidden="true"
          >
            <span className="selected">
              <MousePointer2Icon />
            </span>
            <HandIcon />
            <SquareIcon />
            <CircleIcon />
            <PenToolIcon />
            <i />
            <Undo2Icon />
            <Redo2Icon />
          </div>
          <div className="preview-artboard relative w-66 h-66 bg-[#f3f2ea] shadow-[0_2px_7px_rgb(0_0_0_/_.07)] p-7.5 [&_>_svg]:w-full [&_>_svg]:h-full [&_>_svg]:transition-[fill] [&_>_svg]:duration-200 [&_>_svg]:ease-[ease] max-[1051px]:w-58.75 max-[1051px]:h-58.75 max-[1051px]:p-6.25 max-[1051px]:[&_.selection-corners]:[inset:47px] max-[761px]:w-57.5 max-[761px]:h-57.5 max-[481px]:w-56 max-[481px]:h-56 max-[481px]:p-6.25 max-[481px]:[&_.selection-corners]:[inset:46px]">
            <ArtworkMark color={color} />
            <SelectionCorners />
          </div>
          <span className="preview-dimensions absolute bottom-4 text-[8px] text-muted-foreground [font-family:monospace]">
            480 × 480
          </span>
        </div>
        <aside
          className="preview-inspector border-l bg-landing-surface pt-4 pr-3 pb-4 pl-3 flex flex-col gap-3 [&_>_strong]:text-[11px] [&_>_strong]:font-medium [&_>_p]:text-[10px] [&_>_p]:leading-[1.5] [&_>_p]:mt-0.75 max-[761px]:hidden"
          aria-label="Example properties"
        >
          <span className="preview-field-label text-[8px] tracking-[.06em] text-muted-foreground">
            SELECTION
          </span>
          <strong>Bloom mark</strong>
          <div className="preview-field-grid grid grid-cols-2 gap-1.75 [&_>_div]:flex [&_>_div]:gap-2.25 [&_>_div]:items-center [&_>_div]:border [&_>_div]:p-1.75 [&_>_div]:text-[10px] [&_>_div]:bg-background [&_span]:text-muted-foreground [&_span]:text-[8px]">
            <div>
              <span>X</span>80
            </div>
            <div>
              <span>Y</span>80
            </div>
            <div>
              <span>W</span>320
            </div>
            <div>
              <span>H</span>320
            </div>
          </div>
          <div className="preview-section-line h-px bg-border mt-0.75 mr-[-12px] mb-0.75 ml-[-12px]" />
          <span className="preview-field-label text-[8px] tracking-[.06em] text-muted-foreground">
            FILL
          </span>
          <div className="preview-color-field flex items-center gap-1.75 p-1.75 border text-[10px] bg-background [&_>_span:first-child]:w-3.5 [&_>_span:first-child]:h-3.5 [&_>_span:last-child]:ml-auto [&_>_span:last-child]:text-[8px] [&_>_span:last-child]:text-muted-foreground">
            <span style={{ backgroundColor: color }} />
            {color.toUpperCase()}
            <span>100%</span>
          </div>
          <Palette color={color} onChange={setColor} />
          <div className="preview-section-line h-px bg-border mt-0.75 mr-[-12px] mb-0.75 ml-[-12px]" />
          <span className="preview-field-label text-[8px] tracking-[.06em] text-muted-foreground">
            CANVAS
          </span>
          <div className="preview-field-grid grid grid-cols-2 gap-1.75 [&_>_div]:flex [&_>_div]:gap-2.25 [&_>_div]:items-center [&_>_div]:border [&_>_div]:p-1.75 [&_>_div]:text-[10px] [&_>_div]:bg-background [&_span]:text-muted-foreground [&_span]:text-[8px]">
            <div>
              <span>W</span>480
            </div>
            <div>
              <span>H</span>480
            </div>
          </div>
          <p className="text-muted-foreground leading-[1.65]">
            Your next idea starts with a little space.
          </p>
        </aside>
      </div>
      <div className="preview-status flex justify-between items-center min-h-6.75 border-t pt-1 pr-2.75 pb-1 pl-2.75 text-[8px] text-muted-foreground [&_>_span]:flex [&_>_span]:items-center [&_>_span]:gap-1.5 [&_svg]:w-2.5 [&_svg]:h-2.5 max-[481px]:text-[7px] max-[481px]:px-1.75">
        <span>
          <MousePointer2Icon />
          Bloom selected
        </span>
        <div className="preview-mobile-palette hidden max-[761px]:block max-[761px]:[&_.preview-palette]:gap-1.75 max-[761px]:[&_button]:w-4.25 max-[761px]:[&_button]:h-4.25">
          <Palette color={color} onChange={setColor} />
        </div>
        <span>
          480 × 480 px
          <span className="preview-zoom inline-flex gap-2.75 items-center ml-4.5 max-[481px]:hidden">
            <MinusIcon />
            100%
            <PlusIcon />
          </span>
        </span>
      </div>
    </div>
  )
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
