import PageLayout from "@/components/shared/PageLayout";
import PLView from "@/components/pl/PLView";
import { getStores } from "@/lib/stores";
import { isMetaConnected } from "@/lib/meta";
import { isGoogleConnected } from "@/lib/googleAds";
import { isTikTokConnected } from "@/lib/tiktok";

export const revalidate = 0;

export default async function PLPage() {
  const stores = await getStores();

  return (
    <PageLayout
      stores={stores}
      activePage="P&L"
      title="Profit & Loss"
      subtitle="Revenue from Shopify · ad spend auto-pulled from connected platforms"
    >
      <PLView
        metaConnected={isMetaConnected()}
        googleConnected={isGoogleConnected()}
        tiktokConnected={isTikTokConnected()}
      />
    </PageLayout>
  );
}
