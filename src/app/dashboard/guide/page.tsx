"use client";

import { useSession } from "next-auth/react";
import { ReactNode } from "react";
import { BookOpen } from "lucide-react";

type Role = "MASTER" | "ADMIN" | "MANAGER" | "DOER";

function Section({
  title,
  roles,
  userRole,
  children,
}: {
  title: string;
  roles: Role[] | "all";
  userRole: Role;
  children: ReactNode;
}) {
  if (roles !== "all" && !roles.includes(userRole)) return null;
  return (
    <details className="group bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden" open>
      <summary className="cursor-pointer select-none px-5 py-4 font-semibold text-slate-900 hover:bg-slate-50 flex items-center justify-between">
        {title}
        <span className="text-slate-400 text-sm group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="px-5 pb-5 pt-1 text-sm text-slate-600 space-y-2 leading-relaxed">
        {children}
      </div>
    </details>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal list-inside space-y-1.5 ml-1">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1.5 ml-1">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function GuideBookPage() {
  const { data: session } = useSession();
  const role = (session?.user.role as Role) || "DOER";
  const isStaff = role === "MASTER" || role === "ADMIN" || role === "MANAGER";

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Guide Book</h1>
          <p className="text-sm text-slate-500">
            Showing help for your role: <span className="font-semibold text-blue-600">{role}</span>
          </p>
        </div>
      </div>

      <Section title="Getting Started" roles="all" userRole={role}>
        <p>The sidebar (menu on mobile) has all the sections you have access to: Overview, Installations, Complaints, Site Visits{isStaff ? ", Manage Users" : ""}, and this Guide Book.</p>
        <p>Every task (Installation, Complaint, or Site Visit) always has a status: <strong>PENDING</strong> → <strong>ASSIGNED</strong> → <strong>IN_PROGRESS</strong> → <strong>COMPLETED</strong>. Each list page has a <strong>Pending</strong> and a <strong>Completed</strong> tab — a task moves itself to Completed automatically once its final step is submitted.</p>
      </Section>

      <Section title="Your Tasks (Doer)" roles={["DOER"]} userRole={role}>
        <p>Every list page (Installations, Complaints, Site Visits) only shows the tasks currently assigned to you. When a task is completed, it moves to that page's Completed tab.</p>
        <p>You&apos;ll get a push notification the moment a task is assigned to you, and whenever you complete a step your Manager/Admin/Master gets notified too.</p>
      </Section>

      <Section title="Updating Task Progress (Doer)" roles={["DOER"]} userRole={role}>
        <p>Open a task and tap <strong>Update Progress</strong>. Every task — Installation, Complaint, or Site Visit — has the same 3 steps, done in order:</p>
        <Steps
          items={[
            "Step 1 — Site Photo/Video & Location: take a photo at the site (video optional), then tap \"Capture current location\" to record your GPS location.",
            "Step 2 — Work Evidence: for Installations/Complaints, upload a photo/video proving the work is done. For Site Visits, write the visit details and upload the site chart/calculation file.",
            "Step 3 — Expense & Bills: enter how much you spent, add notes if needed, and upload bill photos/PDFs (optional). Submitting this step marks the task Completed.",
          ]}
        />
        <p>Steps must be done in order — Step 2 unlocks only after Step 1, and Step 3 only after Step 2.</p>
      </Section>

      <Section title="Fund & Expenses (Doer)" roles={["DOER"]} userRole={role}>
        <p>If your Manager/Admin gave you a cash <strong>Fund</strong> when assigning the task, it will show in the task&apos;s assignment info. When you submit Step 3, enter the actual amount you spent as the <strong>Expense</strong> — this is compared against the Fund in the Completed tab summary that staff can see.</p>
      </Section>

      <Section title="Installations" roles={["MASTER", "ADMIN", "MANAGER"]} userRole={role}>
        <p>Installation records come from a connected Google Sheet.</p>
        <Bullets
          items={[
            "\"Sync from Google Sheets\" pulls the latest rows into the system.",
            "\"Configure Columns\" lets you choose which sheet columns are pulled in and shown in the table — change this anytime, then Sync again.",
            "\"Assign Doer\" lets you pick one or more Doers and optionally give them a Fund amount for expenses.",
          ]}
        />
      </Section>

      <Section title="Complaints" roles={["MASTER", "ADMIN", "MANAGER"]} userRole={role}>
        <p>Customers (or your team) submit complaints through the public form at <strong>Open Public Form</strong> — no login needed. It requires either a Job No or Door Serial No, customer details, site location, attendant details, at least 1 photo and 1 video of the problem, and an issue description. An invoice/bill can optionally be attached.</p>
        <p>Assign Doers the same way as Installations, then track progress from the Complaints list.</p>
      </Section>

      <Section title="Site Visits" roles={["MASTER", "ADMIN", "MANAGER"]} userRole={role}>
        <p>Use <strong>New Site Visit</strong> to raise one internally, or share the public link (<code>/site-visit-form</code>) with anyone — no login required. Each visit gets an auto-numbered Serial No (e.g. SV-0001).</p>
        <p>Assigning Doers and tracking progress works the same as Installations/Complaints (3-step flow, ending in Completed after Step 3).</p>
      </Section>

      <Section title="Assigning Doers & Checking Availability" roles={["MASTER", "ADMIN", "MANAGER"]} userRole={role}>
        <p>Open <strong>Assign Doer</strong> on any task to pick one or more Doers. Each Doer shows a <span className="text-green-700 font-medium">Free</span> badge or a <span className="text-amber-700 font-medium">Busy: task name</span> badge, so you can see at a glance who is available before assigning more work.</p>
        <p>You can optionally give a Fund amount (and notes) to the Doers you select — this is recorded per assignment and compared later against their reported expense.</p>
        <p>The same Free/Busy information is also visible per Doer in <strong>Manage Users</strong>, under the Availability column.</p>
      </Section>

      <Section title="Completed Tab Summary" roles={["MASTER", "ADMIN", "MANAGER"]} userRole={role}>
        <p>Switch any list page to its <strong>Completed</strong> tab to see a summary for each finished task:</p>
        <Bullets
          items={[
            "Fund Given — total cash given to the assigned Doer(s) at assignment time.",
            "Expense / Bill — the amount the Doer reported spending in Step 3, with links to uploaded bills.",
            "Balance — Fund minus Expense (green = money left with the Doer, red = they spent more than the fund).",
            "Step 1 → 2 — how many days passed between the Doer's arrival (Step 1) and finishing the work/visit details (Step 2), showing turnaround time.",
          ]}
        />
      </Section>

      <Section title="Manage Users & Roles" roles={["MASTER", "ADMIN", "MANAGER"]} userRole={role}>
        <p>Who can create/edit/delete which accounts:</p>
        <Bullets
          items={[
            "MASTER — can manage everyone (Admin, Manager, Doer).",
            "ADMIN — can manage Manager and Doer accounts, not Master or other Admins.",
            "MANAGER — can only create, edit, and delete Doer accounts.",
          ]}
        />
        <p>The Availability column shows whether each Doer is currently Free or occupied on active (non-completed) tasks.</p>
      </Section>

      <Section title="Notifications" roles="all" userRole={role}>
        <p>Push notifications (via OneSignal) keep everyone in sync automatically:</p>
        <Bullets
          items={
            isStaff
              ? [
                  "You're notified whenever a Doer completes any step on a task.",
                ]
              : [
                  "You're notified the moment a task is assigned to you.",
                ]
          }
        />
        <p>Make sure notification permission is allowed for the site/app so you don&apos;t miss updates.</p>
      </Section>
    </div>
  );
}
