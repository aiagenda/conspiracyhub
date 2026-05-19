import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { nicknameFromAuthMetadata, parseNicknameInput } from "@/lib/nickname";
import { toAccountJson, type AccountProfileRow } from "@/lib/accountResponse";
import { buildSignupTrialPatch, canClaimLegacyTrial } from "@/lib/userPlan";
import { mergeTrialIntoInsert } from "@/lib/server/proTrial";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

const PROFILE_SELECT =
  "email, nickname, plan, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, subscription_cancel_at_period_end, pro_trial_ends_at, pro_trial_granted_at, pro_trial_redeemed, created_at";

async function loadOrCreateProfile(
  admin: ReturnType<typeof getAdmin>,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
): Promise<AccountProfileRow | null> {
  let { data: profile, error: selErr } = await admin
    .from("user_profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (selErr) throw new Error(selErr.message);

  if (!profile) {
    const email = user.email ?? "";
    const nickname = nicknameFromAuthMetadata(user.user_metadata);
    const { error: insErr } = await admin.from("user_profiles").insert(
      mergeTrialIntoInsert({
        id: user.id,
        email,
        ...(nickname ? { nickname } : {}),
      }),
    );
    if (insErr) throw new Error(insErr.message);

    const again = await admin.from("user_profiles").select(PROFILE_SELECT).eq("id", user.id).single();
    profile = again.data;
  }

  return profile as AccountProfileRow | null;
}

/** Profile + billing summary for the signed-in user (Bearer JWT). */
export async function GET(req: NextRequest) {
  try {
    const admin = getAdmin();
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "missing_token" }, { status: 401 });
    }
    const token = auth.replace(/^Bearer\s+/i, "");
    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(token);
    if (userErr || !user) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const profile = await loadOrCreateProfile(admin, user);
    if (!profile) {
      return NextResponse.json({ error: "profile_missing" }, { status: 500 });
    }

    return NextResponse.json(toAccountJson(profile));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Update nickname or claim legacy Analyst Pass trial. */
export async function PATCH(req: NextRequest) {
  try {
    const admin = getAdmin();
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "missing_token" }, { status: 401 });
    }
    const token = auth.replace(/^Bearer\s+/i, "");
    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(token);
    if (userErr || !user) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const claimTrial = (body as { claim_trial?: unknown }).claim_trial === true;

    if (claimTrial) {
      const profile = await loadOrCreateProfile(admin, user);
      if (!profile) {
        return NextResponse.json({ error: "profile_missing" }, { status: 500 });
      }
      if (!canClaimLegacyTrial(profile)) {
        return NextResponse.json({ error: "trial_not_available" }, { status: 400 });
      }
      const { error: upErr } = await admin
        .from("user_profiles")
        .update(buildSignupTrialPatch())
        .eq("id", user.id);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      const { data: updated } = await admin
        .from("user_profiles")
        .select(PROFILE_SELECT)
        .eq("id", user.id)
        .single();
      return NextResponse.json(toAccountJson(updated as AccountProfileRow));
    }

    const nicknameRaw = (body as { nickname?: unknown }).nickname;
    const parsed = parseNicknameInput(nicknameRaw);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { data: updatedRows, error: upErr } = await admin
      .from("user_profiles")
      .update({ nickname: parsed.value })
      .eq("id", user.id)
      .select("id");

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    if (!updatedRows?.length) {
      const email = user.email ?? "";
      if (!email) {
        return NextResponse.json({ error: "profile_missing_email" }, { status: 400 });
      }
      const { error: insErr } = await admin.from("user_profiles").insert(
        mergeTrialIntoInsert({
          id: user.id,
          email,
          nickname: parsed.value,
        }),
      );
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ nickname: parsed.value });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
