import { NextResponse } from "next/server";

const COOKIE_NAME = "market_tracker_auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = String(body.password ?? "");

  if (!process.env.SITE_PASSWORD || !process.env.SITE_AUTH_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "Login ist nicht konfiguriert." },
      { status: 500 }
    );
  }

  if (password !== process.env.SITE_PASSWORD) {
    return NextResponse.json(
      { ok: false, error: "Falsches Passwort." },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true });

  res.cookies.set(COOKIE_NAME, process.env.SITE_AUTH_TOKEN, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}