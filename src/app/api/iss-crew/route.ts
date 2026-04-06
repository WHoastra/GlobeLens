import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("http://api.open-notify.org/astros.json", {
      next: { revalidate: 3600 }, // cache for 1 hour
    });
    if (!res.ok) throw new Error(`ISS crew API error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message, number: null, people: [] }, { status: 500 });
  }
}
