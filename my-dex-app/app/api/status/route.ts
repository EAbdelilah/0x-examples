import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tradeHash = searchParams.get("tradeHash");

  const res = await fetch(
    `https://api.0x.org/gasless/status/${tradeHash}`,
    {
      headers: {
        "0x-api-key": process.env.NEXT_PUBLIC_ZEROEX_API_KEY as string,
      },
    }
  );

  const data = await res.json();

  return Response.json(data);
}
