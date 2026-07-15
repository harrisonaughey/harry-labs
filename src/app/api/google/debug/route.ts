import { NextResponse } from "next/server";
import { isGoogleConnected, listAccessibleCustomers } from "@/lib/googleAds";

export async function GET() {
  const configuredCustomerId = process.env.GOOGLE_ADS_CUSTOMER_ID ?? "(not set)";
  const loginCustomerId      = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "(not set)";
  const hasDevToken          = !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const hasClientId          = !!process.env.GOOGLE_ADS_CLIENT_ID;
  const hasClientSecret      = !!process.env.GOOGLE_ADS_CLIENT_SECRET;
  const hasRefreshToken      = !!process.env.GOOGLE_ADS_REFRESH_TOKEN;

  if (!isGoogleConnected()) {
    return NextResponse.json({
      connected: false,
      envVars: { hasDevToken, hasClientId, hasClientSecret, hasRefreshToken, configuredCustomerId },
    });
  }

  try {
    const accessibleCustomers = await listAccessibleCustomers();
    return NextResponse.json({
      connected:            true,
      configuredCustomerId,
      loginCustomerId,
      accessibleCustomers,
      customerMatch:        accessibleCustomers.includes(configuredCustomerId.replace(/-/g, "")),
      envVars:              { hasDevToken, hasClientId, hasClientSecret, hasRefreshToken },
    });
  } catch (e: any) {
    return NextResponse.json({
      connected: true,
      error:     e.message,
      configuredCustomerId,
      envVars:   { hasDevToken, hasClientId, hasClientSecret, hasRefreshToken },
    });
  }
}
