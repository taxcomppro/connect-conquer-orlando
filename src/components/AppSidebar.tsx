import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BriefcaseBusiness,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  Network,
  Settings,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", to: "/leads", icon: Users },
  { label: "Pipeline", to: "/pipeline", icon: BarChart3 },
  { label: "Broadcast", to: "/broadcast", icon: Megaphone },
  { label: "Automations", to: "/automations", icon: MessagesSquare },
  { label: "DUB", to: "/dub", icon: Network },
  { label: "Briefing", to: "/briefing", icon: BriefcaseBusiness },
  { label: "Admin", to: "/admin", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <Link
          to="/dashboard"
          onClick={() => setOpenMobile(false)}
          className="flex min-h-9 items-center gap-3 overflow-hidden"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-signal-line bg-signal-soft font-display text-lg text-signal">
            T
          </span>
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block truncate font-display text-base">Field Hub</span>
            <span className="eyebrow block truncate">Member CRM</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="eyebrow">Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link to={item.to} onClick={() => setOpenMobile(false)}>
                        <item.icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}