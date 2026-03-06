import { NextResponse } from "next/server";
import { getSTMStatus } from "@/app/lib/stm";

export async function GET() {
  const statuses = await getSTMStatus();
  return NextResponse.json(statuses);
}
