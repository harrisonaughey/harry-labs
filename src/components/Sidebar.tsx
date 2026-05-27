"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import StoreSwitcher from "./StoreSwitcher";
import type { Store } from "@/lib/stores";

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
    ],
  },
  {
    group: "Marketing",
    items: [
      { label: "Email",         href: "/email",       icon: "✉" },
      { label: "Paid Ads",      href: "/traffic",     icon: "📡" },
      { label: "Content",       href: "/content",     icon: "🎬" },
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

  // Determine active href from pathname (client-side routing)
  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function handleNav(href: string) {
    router.push(href);
  }

  return (
    <aside
      className="w-56 flex flex-col flex-shrink-0 h-full"
      style={{ background: "#0d0d14", borderRight: "1px solid #1e1e2e" }}
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
            <p className="font-semibold text-white text-sm leading-none">Harry Labs</p>
            <p className="text-xs mt-0.5" style={{ color: "#4b5563" }}>thinkle.com.au</p>
          </div>
        </div>
      </div>

      {/* Store Switcher */}
      <div className="px-3 mb-3 flex-shrink-0">
        <StoreSwitcher stores={stores} currentStoreId={currentStoreId} />
      </div>

      <div className="mx-3 mb-3 flex-shrink-0" style={{ height: "1px", background: "#1e1e2e" }} />

      {/* Nav groups */}
      <nav className="flex-1 px-3 overflow-y-auto pb-4 space-y-5">
        {NAV.map((group) => (
          <div key={group.group}>
            <p
              className="text-xs font-semibold uppercase tracking-widest px-2 mb-1.5"
              style={{ color: "#2d2d42" }}
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
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left group relative"
                    style={{
                      background: active ? "#1a1a2e" : "transparent",
                      color: active ? "#a5b4fc" : "#6b7280",
                    }}
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
      </nav>

      {/* User */}
      <div className="px-4 py-4 flex-shrink-0" style={{ borderTop: "1px solid #1e1e2e" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: "#6366f1" }}
          >
            H
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white truncate">Harrison</p>
            <p className="text-xs truncate" style={{ color: "#4b5563" }}>Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
