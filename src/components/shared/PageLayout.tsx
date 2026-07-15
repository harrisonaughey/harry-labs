import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import StoreTabBar from "@/components/StoreTabBar";
import type { Store } from "@/lib/stores";

type Props = {
  stores: Store[];
  activePage: string;
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  currentStoreId?: string | null;
  children: React.ReactNode;
};

export default function PageLayout({
  stores,
  activePage,
  title,
  subtitle,
  headerRight,
  currentStoreId = null,
  children,
}: Props) {
  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: "var(--bg-app)" }}>
      <Suspense>
        <Sidebar stores={stores} activePage={activePage} />
      </Suspense>
      <main className="flex-1 overflow-y-auto px-8 py-8">
        <Suspense>
          <StoreTabBar stores={stores} currentStoreId={currentStoreId} />
        </Suspense>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h1>
            {subtitle && <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
          </div>
          {headerRight && <div className="flex items-center gap-3">{headerRight}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}
