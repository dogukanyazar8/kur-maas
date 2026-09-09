import { getQuarterRates, TcmbError } from "../../../lib/tcmb";
import { isCompletePeriod, isPaymentMonth } from "../../../lib/periods";
import type { ApiErrorCode } from "../../../lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(code: ApiErrorCode, status: number) {
  return Response.json(
    { error: code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const yearText = params.get("year") ?? "";
  const monthText = params.get("month") ?? "";
  const year = Number(yearText);
  const month = Number(monthText);
  if (
    params.size !== 2 ||
    params.getAll("year").length !== 1 ||
    params.getAll("month").length !== 1 ||
    !/^\d{4}$/.test(yearText) ||
    !/^(1|4|7|10)$/.test(monthText) ||
    year < 2006 ||
    year > 2100 ||
    !isPaymentMonth(month)
  ) {
    return error("INVALID_PERIOD", 400);
  }
  if (!isCompletePeriod(year, month)) return error("INCOMPLETE_PERIOD", 422);
  try {
    const data = await getQuarterRates(year, month);
    return Response.json(data, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (cause) {
    if (cause instanceof TcmbError) {
      return error(cause.code, cause.code === "BUSY" ? 503 : 502);
    }
    // Never expose upstream response bodies, URLs with unexpected content, or stacks.
    return error("UPSTREAM_ERROR", 502);
  }
}
