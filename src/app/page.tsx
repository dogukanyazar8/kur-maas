import { connection } from "next/server";
import SalaryCalculator from "../components/calculator";
import { getIstanbulYearMonth } from "../lib/periods";

export default async function Page() {
  await connection();
  return <SalaryCalculator initialPeriod={getIstanbulYearMonth()} />;
}
