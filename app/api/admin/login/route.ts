import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { pin } = await req.json();

  const adminPin = process.env.ADMIN_PIN;

  if (!adminPin) {
    return NextResponse.json(
      { success: false, error: "ADMIN_PIN missing" },
      { status: 500 }
    );
  }

  if (pin !== adminPin) {
    return NextResponse.json(
      { success: false },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}