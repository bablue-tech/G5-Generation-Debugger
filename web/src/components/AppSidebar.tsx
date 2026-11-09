import {
  BookOpen,
  Clapperboard,
  ExternalLink,
  FolderKanban,
  Images,
  LayoutGrid,
  LifeBuoy,
  MessageSquare,
  Plug,
  Sparkles,
  Stethoscope,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "./ui";

const STUDIO = "https://aistudio.galleri5.com";

type Item = { text: string; icon: LucideIcon; href?: string; active?: boolean; badge?: string };
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "CREATE",
    items: [
      { text: "Chat", icon: MessageSquare, href: "/chat" },
      { text: "Model Garden", icon: Sparkles, href: "/model-garden" },
      { text: "Movie Studio", icon: Clapperboard, href: "/chat/projects", badge: "Beta" },
    ],
  },
  {
    title: "TOOLS",
    items: [
      { text: "Apps", icon: LayoutGrid, href: "/apps" },
      { text: "Contexts", icon: BookOpen, href: "/contexts" },
      { text: "Library", icon: Images, href: "/generations" },
      { text: "MCP", icon: Plug, href: "/mcp/setup" },
      { text: "Debugging", icon: Stethoscope, active: true, badge: "New" },
    ],
  },
  { title: "PROJECTS", items: [{ text: "Projects", icon: FolderKanban, href: "/projects" }] },
];

function MenuButton({ item }: { item: Item }) {
  const Icon = item.icon;
  const classes = cn(
    "group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-[0.9rem] outline-hidden ring-sidebar-ring transition-colors",
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2",
    item.active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
  );
  const body = (
    <>
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{item.text}</span>
      {item.badge && (
        <span
          className={cn(
            "ml-auto flex h-[18px] items-center rounded-full px-1.5 text-[9px] font-bold uppercase tracking-wide",
            item.badge === "New" ? "bg-amber-500 text-neutral-950" : "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950",
          )}
        >
          {item.badge}
        </span>
      )}
      {item.href && !item.badge && <ExternalLink className="ml-auto size-3 opacity-0 transition-opacity group-hover/menu-button:opacity-50" />}
    </>
  );
  return (
    <li>
      {item.href ? (
        <a className={classes} href={`${STUDIO}${item.href}`} target="_blank" rel="noopener noreferrer" title={`Open ${item.text} in AI Studio`}>
          {body}
        </a>
      ) : (
        <a className={classes} href="#" aria-current="page">
          {body}
        </a>
      )}
    </li>
  );
}

export function SidebarContent({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <img src="/g5-mark.webp" alt="" className="size-7 rounded-full" />
        <span className="text-[0.95rem] font-semibold tracking-tight">AI Studio</span>
        {onClose && (
          <button type="button" onClick={onClose} className="ml-auto rounded-md p-1.5 hover:bg-sidebar-accent" aria-label="Close menu">
            <X className="size-4" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto" aria-label="AI Studio">
        {GROUPS.map((group, i) => (
          <div key={group.title}>
            {i > 0 && <div className="mx-2 h-px bg-neutral-200/80 dark:bg-neutral-800" />}
            <div className="relative flex w-full min-w-0 flex-col p-2">
              <div className="flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70">{group.title}</div>
              <ul className="flex w-full min-w-0 flex-col gap-1">
                {group.items.map((item) => (
                  <MenuButton key={item.text} item={item} />
                ))}
              </ul>
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-2">
        <MenuButton item={{ text: "Support tickets", icon: LifeBuoy, href: "/support/tickets" }} />
        <div className="mt-1 flex items-center gap-2.5 rounded-md p-2">
          <span className="grid size-7 place-items-center rounded-full bg-amber-500 text-[11px] font-semibold text-neutral-950">G5</span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium">Galleri5 Studio</div>
            <div className="truncate text-xs text-muted-foreground">Sample workspace</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-svh w-56 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={onClose} />
      <aside className="animate-fade-up absolute inset-y-0 left-0 w-[min(20rem,86vw)] bg-sidebar text-sidebar-foreground shadow-xl">
        <SidebarContent onClose={onClose} />
      </aside>
    </div>
  );
}
