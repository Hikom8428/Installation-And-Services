"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Users, FileText, ClipboardList, LogOut, Wrench, Menu, MapPin, X } from "lucide-react";
import PushNotificationSetup from "@/components/PushNotificationSetup";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Close the mobile sidebar whenever the route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard, show: true },
    { name: "Installations", href: "/dashboard/installations", icon: FileText, show: true },
    { name: "Complaints", href: "/dashboard/complaints", icon: ClipboardList, show: true },
    { name: "Site Visits", href: "/dashboard/site-visits", icon: MapPin, show: true },
    { name: "Manage Users", href: "/dashboard/users/new", icon: Users, show: session.user.role === "MASTER" || session.user.role === "ADMIN" || session.user.role === "MANAGER" },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <PushNotificationSetup userId={session.user.id} />

      {/* Backdrop, mobile only, shown while the sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — off-canvas drawer on mobile, always visible from lg up */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-40 transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 bg-slate-950/50 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white">
            <Wrench className="w-6 h-6 text-blue-500" />
            <span className="text-xl font-bold tracking-wide">HICON</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white lg:hidden">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shadow-md">
              {session.user.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-white truncate w-32">{session.user.name}</p>
              <p className="text-xs text-blue-400 font-medium">{session.user.role}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.filter(item => item.show).map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.name} 
                href={item.href} 
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                  isActive 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" 
                    : "hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-blue-200" : "text-slate-400"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors font-medium"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Header Mobile */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 sm:px-6 lg:hidden shadow-sm flex-shrink-0">
           <button onClick={() => setSidebarOpen(true)} className="text-slate-500 hover:text-slate-700">
             <Menu className="w-6 h-6" />
           </button>
           <span className="ml-4 font-bold text-lg text-slate-800">HICON</span>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
