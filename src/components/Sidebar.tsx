"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import StoreSwitcher from "./StoreSwitcher";
import { useTheme } from "@/components/ThemeProvider";
import { createClient } from "@/lib/supabase/browser";
import type { Store } from "@/lib/stores";

type SidebarUser = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "viewer" | "tester";
};

type NavItem = {
  label: string;
  href: string;
  icon: string;
};

type NavGroup = {
  group: string;
  items: NavItem[];
};

const NAV: NavGroup[] = [
  {
    group: "Command",
    items: [
      { label: "Overview",      href: "/",            icon: "◈" },
    ],
  },
  {
    group: "Revenue",
    items: [
      { label: "Shopify Store", href: "/shopify",     icon: "🛍" },
      { label: "Orders",        href: "/orders",      icon: "📦" },
      { label: "Products",      href: "/products",    icon: "🏷" },
      { label: "Amazon",        href: "/amazon",      icon: "📫" },
      { label: "P&L",           href: "/pl",          icon: "📊" },
      { label: "CFO Hub",        href: "/cfo",         icon: "💼" },
    ],
  },
  {
    group: "Marketing",
    items: [
      { label: "Email",         href: "/email",             icon: "✉"  },
      { label: "Campaigns",     href: "/content-calendar",  icon: "📅" },
      { label: "Paid Ads",      href: "/traffic",           icon: "📡" },
      { label: "Content",       href: "/content",           icon: "🎬" },
    ],
  },
  {
    group: "Analytics",
    items: [
      { label: "Business",      href: "/analytics",   icon: "📈" },
      { label: "Web",           href: "/web",         icon: "🌐" },
      { label: "Customers",     href: "/customers",   icon: "👥" },
    ],
  },
  {
    group: "Operations",
    items: [
      { label: "Support",       href: "/support",     icon: "🎧" },
      { label: "Automations",   href: "/automations", icon: "⚡" },
      { label: "Integrations",  href: "/integrations",icon: "🔌" },
      { label: "Settings",      href: "/settings",    icon: "⚙" },
    ],
  },
];

export default function Sidebar({ stores, activePage }: { stores: Store[]; activePage?: string }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const searchParams = useSearchParams();
  const currentStoreId = searchParams.get("store");
  const { theme, toggle } = useTheme();
  const [user, setUser] = useState<SidebarUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user: u } }: { data: { user: { id: string; email?: string; user_metadata?: Record<string, string> } | null } }) => {
      if (!u) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", u.id)
        .single();
      setUser({
        id: u.id,
        email: u.email ?? "",
        full_name: profile?.full_name ?? u.user_metadata?.full_name ?? "",
        role: profile?.role ?? "viewer",
      });
    });
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const isAdmin = user?.role === "admin";
  const isTester = user?.role === "tester";
  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "?";

  // Determine active href from pathname (client-side routing)
  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function handleNav(href: string) {
    const params = new URLSearchParams();
    if (currentStoreId) params.set("store", currentStoreId);
    const query = params.toString();
    router.push(query ? `${href}?${query}` : href);
  }

  return (
    <aside
      className="w-56 flex flex-col flex-shrink-0 h-full"
      style={{ background: "var(--bg-sidebar)", borderRight: "1px solid var(--border)" }}
    >
      {/* Logo */}
      <div className="px-5 py-5 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            H
          </div>
          <div>
            <p className="font-semibold text-sm leading-none" style={{ color: "var(--text-primary)" }}>Harry Labs</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>thinkle.com.au</p>
          </div>
        </div>
      </div>

      {/* Store Switcher */}
      <div className="px-3 mb-3 flex-shrink-0">
        <StoreSwitcher stores={stores} currentStoreId={currentStoreId} />
      </div>

      <div className="mx-3 mb-3 flex-shrink-0" style={{ height: "1px", background: "var(--border)" }} />

      {/* Demo mode badge */}
      {isTester && (
        <div className="mx-3 mb-2 flex-shrink-0 px-2.5 py-1.5 rounded-lg" style={{ background: "#1c1a0e", border: "1px solid #3d3008" }}>
          <p className="text-xs font-semibold" style={{ color: "#fbbf24" }}>⚠ Demo Mode</p>
          <p className="text-xs" style={{ color: "#78716c" }}>Showing placeholder data</p>
        </div>
      )}

      {/* Nav groups */}
      <nav className="flex-1 px-3 overflow-y-auto pb-4 space-y-5">
        {NAV.map((group) => (
          <div key={group.group}>
            <p
              className="text-xs font-semibold uppercase tracking-widest px-2 mb-1.5"
              style={{ color: "var(--text-nav-label)" }}
            >
              {group.group}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <button
                    key={item.href}
                    onClick={() => handleNav(item.href)}
                    data-active={active ? "true" : "false"}
                    className="nav-item w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-left relative"
                  >
                    {/* Active indicator */}
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full"
                        style={{ background: "#6366f1" }}
                      />
                    )}
                    <span className="text-sm w-4 text-center flex-shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Admin group — only shown when role is admin */}
        {isAdmin && (
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest px-2 mb-1.5"
              style={{ color: "var(--text-nav-label)" }}
            >
              Admin
            </p>
            <div className="space-y-0.5">
              {[{ label: "Users", href: "/admin/users", icon: "👤" }].map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <button
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    data-active={active ? "true" : "false"}
                    className="nav-item w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-left relative"
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full"
                        style={{ background: "#6366f1" }}
                      />
                    )}
                    <span className="text-sm w-4 text-center flex-shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Footer: theme + user + logout */}
      <div className="px-4 py-4 flex-shrink-0 space-y-2.5" style={{ borderTop: "1px solid var(--border)" }}>
        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="sidebar-footer-btn w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium"
          style={{
            background: "var(--bg-subtle)",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
        >
          <span className="text-sm w-4 text-center flex-shrink-0">
            {theme === "dark" ? "☀" : "🌙"}
          </span>
          <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>

        {/* User row + logout */}
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: "#6366f1" }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {user?.full_name || user?.email || "…"}
            </p>
            <p className="text-xs capitalize truncate" style={{ color: "var(--text-faint)" }}>
              {user?.role ?? "…"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Sign out"
            className="btn-danger flex-shrink-0 text-xs px-2 py-1 rounded-md"
            style={{ color: "#6b7280", background: "none" }}
          >
            {loggingOut ? "…" : "↩"}
          </button>
        </div>
      </div>
    </aside>
  );
}
