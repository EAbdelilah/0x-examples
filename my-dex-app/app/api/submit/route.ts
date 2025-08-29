import { type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const payload = await request.json();

  const res = await fetch(`https://api.0x.org/gasless/submit`, {
    method: "POST",
    headers: {
      "0x-api-key": process.env.NEXT_PUBLIC_ZEROEX_API_KEY as string,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
