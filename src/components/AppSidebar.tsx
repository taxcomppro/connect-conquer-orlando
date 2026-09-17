import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  LayoutDashboard,
  Inbox,
  Megaphone,
  MessagesSquare,
  ScanLine,
  Settings,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
  { label: "Pipeline", to: "/pipeline", icon: BarChart3 },
  { label: "Funnel", to: "/funnel", icon: Filter },
  { label: "Inbox", to: "/inbox", icon: Inbox },
  { label: "Leads", to: "/leads", icon: Users },
  { label: "Broadcast", to: "/broadcast", icon: Megaphone },
  { label: "Automations", to: "/automations", icon: MessagesSquare },
  { label: "Admin", to: "/admin", icon: Settings },
] as const;

export function AppSidebar({ unreadInbox = 0 }: { unreadInbox?: number }) {
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
            <span className="block truncate font-display text-base">Membership Hub</span>
            <span className="eyebrow block truncate">Tax Compliance Pro</span>
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
                        {item.to === "/inbox" && unreadInbox > 0 ? (
                          <span className="ml-auto rounded-full border border-signal-line bg-signal-soft px-1.5 py-0.5 font-mono text-[10px] text-signal group-data-[collapsible=icon]:hidden">
                            {unreadInbox}
                          </span>
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/scan" || pathname.startsWith("/scan/")}
              tooltip="Scan"
            >
              <Link to="/scan" onClick={() => setOpenMobile(false)}>
                <ScanLine aria-hidden="true" />
                <span>Scan</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}