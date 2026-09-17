import { AssignmentInfo } from "@/components/AssignDoersModal";

export interface StepSummary {
  step1At: string | null;
  step2At: string | null;
  step3At: string | null;
  daysStep1To2: number | null;
  expenseAmount: number | null;
  billUrls: string[];
}

// Fund/Expense/Bill/turnaround-time summary shown for completed tasks —
// used in the Completed tab of Installations, Complaints, and Site Visits.
export default function CompletedTaskSummary({
  assignments,
  stepSummary,
  showExpense,
}: {
  assignments: AssignmentInfo[];
  stepSummary: StepSummary | null;
  showExpense: boolean;
}) {
  const totalFund = assignments.reduce((sum, a) => sum + (a.fundAmount || 0), 0);
  const expense = stepSummary?.expenseAmount ?? null;
  const balance = showExpense && expense !== null ? totalFund - expense : null;

  return (
    <div className="text-xs space-y-1 min-w-[10rem]">
      <div className="flex justify-between gap-3">
        <span className="text-slate-400">Fund Given</span>
        <span className="font-medium text-slate-700">{totalFund > 0 ? `₹${totalFund.toLocaleString()}` : "-"}</span>
      </div>

      {showExpense && (
        <div className="flex justify-between gap-3">
          <span className="text-slate-400">Expense / Bill</span>
          <span className="font-medium text-slate-700">{expense !== null ? `₹${expense.toLocaleString()}` : "-"}</span>
        </div>
      )}

      {balance !== null && (
        <div className="flex justify-between gap-3">
          <span className="text-slate-400">Balance</span>
          <span className={`font-semibold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
            {balance >= 0 ? `₹${balance.toLocaleString()} left` : `₹${Math.abs(balance).toLocaleString()} extra`}
          </span>
        </div>
      )}

      {stepSummary?.billUrls && stepSummary.billUrls.length > 0 && (
        <div className="flex justify-between gap-3">
          <span className="text-slate-400">Bills</span>
          <span className="flex gap-1">
            {stepSummary.billUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                #{i + 1}
              </a>
            ))}
          </span>
        </div>
      )}

      <div className="flex justify-between gap-3">
        <span className="text-slate-400">Step 1 → 2</span>
        <span className="font-medium text-slate-700">
          {stepSummary?.daysStep1To2 !== null && stepSummary?.daysStep1To2 !== undefined
            ? `${stepSummary.daysStep1To2} day${stepSummary.daysStep1To2 === 1 ? "" : "s"}`
            : "-"}
        </span>
      </div>
    </div>
  );
}
