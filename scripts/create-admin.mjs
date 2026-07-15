#!/usr/bin/env node
// Run once to create the initial admin account.
// Usage: node scripts/create-admin.mjs <email> <password> [full_name]
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const [email, password, fullName = "Harrison"] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: node scripts/create-admin.mjs <email> <password> [full_name]");
  process.exit(1);
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Create auth user
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName, role: "admin" },
});

if (error) {
  console.error("❌ Failed:", error.message);
  process.exit(1);
}

// Upsert profile with admin role
await supabase.from("profiles").upsert({
  id: data.user.id,
  email,
  full_name: fullName,
  role: "admin",
  is_active: true,
});

console.log(`✅ Admin account created:
   Email:    ${email}
   Name:     ${fullName}
   User ID:  ${data.user.id}

Log in at /login with these credentials.
You will be prompted to set up 2FA on first sign-in.`);
