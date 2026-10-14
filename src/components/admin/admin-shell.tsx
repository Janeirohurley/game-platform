"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRightIcon,
  BarChart3Icon,
  BotIcon,
  Gamepad2Icon,
  LayoutDashboardIcon,
  LogOutIcon,
  PlugIcon,
  RadioIcon,
  ScaleIcon,
  ShieldAlertIcon,
  SwordsIcon,
  UserIcon,
  UsersIcon,
  VideoIcon,
  WalletIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth-client";

/**
 * Admin navigation, in phase order. `soon: true` entries are rendered
 * disabled with a badge: the routes do not exist yet, and showing the
 * roadmap inside the navigation is honest — no dead links.
 */
const adminNav = [
  {
    label: "Supervision",
    items: [
      {
        title: "Tableau de bord",
        href: "/admin",
        icon: LayoutDashboardIcon,
        phase: 1,
      },
    ],
  },
  {
    label: "Plateforme",
    items: [
      { title: "Utilisateurs", href: "/admin/users", icon: UsersIcon, phase: 3 },
      { title: "Gamers", href: "/admin/gamers", icon: UserIcon, phase: 4 },
      { title: "Jeux", href: "/admin/games", icon: Gamepad2Icon, phase: 5 },
      { title: "Matchs", href: "/admin/matches", icon: SwordsIcon, phase: 6 },
      { title: "Bots", href: "/admin/bots", icon: BotIcon, phase: 13 },
    ],
  },
  {
    label: "Temps réel",
    items: [
      { title: "Rooms Colyseus", href: "/admin/rooms", icon: RadioIcon, phase: 7 },
      { title: "LiveKit", href: "/admin/livekit", icon: VideoIcon, phase: 8 },
      { title: "Statistiques", href: null, icon: BarChart3Icon, phase: 10 },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Portefeuilles", href: "/admin/wallets", icon: WalletIcon, phase: 12 },
      { title: "Transactions", href: "/admin/transactions", icon: ArrowLeftRightIcon, phase: 12 },
      { title: "Fournisseurs", href: "/admin/providers", icon: PlugIcon, phase: 12 },
      { title: "Réconciliation", href: "/admin/reconciliation", icon: ScaleIcon, phase: 12 },
    ],
  },
  {
    label: "Modération",
    items: [{ title: "Journal d'audit", href: "/admin/audit", icon: ShieldAlertIcon, phase: 11 }],
  },
] as const;

export function AdminShell({
  userName,
  userEmail,
  children,
}: {
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const initials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              {/* Base UI composition: `render`, not Radix's asChild. */}
              <SidebarMenuButton
                size="lg"
                tooltip="Console d'administration"
                render={<Link href="/admin" />}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-foreground">
                  GA
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Game Arena</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Console d&apos;administration
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {adminNav.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      {item.href ? (
                        <SidebarMenuButton
                          isActive
                          tooltip={item.title}
                          render={<Link href={item.href} />}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      ) : (
                        <>
                          <SidebarMenuButton disabled tooltip={item.title}>
                            <item.icon />
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                          <SidebarMenuBadge>
                            <Badge variant="outline">phase {item.phase}</Badge>
                          </SidebarMenuBadge>
                        </>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {initials || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{userName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </span>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  {/* Base UI: GroupLabel requires a Menu.Group parent. */}
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      {userName}
                      <Badge variant="secondary" className="ml-2">
                        admin
                      </Badge>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => {
                        void signOut().then(() => router.push("/"));
                      }}
                    >
                      <LogOutIcon />
                      Déconnexion
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {/* Back to the public site — floats over the content flow. */}
        <div className="absolute top-3 left-3 z-20 md:top-4 md:left-4">
          <Button
            variant="outline"
            size="icon-sm"
            render={<Link href="/" aria-label="Retour au site" />}
          >
            ←
          </Button>
        </div>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
