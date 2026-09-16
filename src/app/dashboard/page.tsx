"use client";

import { useSession } from "next-auth/react";
import { FileText, ClipboardList, Users, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { data: session } = useSession();

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Welcome, {session?.user?.name || "User"}
      </h1>
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-slate-500 mt-1">
            Welcome back, <span className="font-semibold text-slate-700">{session?.user?.name || "User"}</span>. Here is what's happening today.
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Placeholder cards for statistics */}
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          <h3 className="text-gray-500 text-sm font-semibold">Total Installations</h3>
          <p className="text-3xl font-bold mt-2">--</p>
        {/* Card 1 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
              +12% <ArrowUpRight className="w-3 h-3"/>
            </span>
          </div>
          <div>
            <h3 className="text-slate-500 text-sm font-medium">Pending Installations</h3>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-4xl font-bold text-slate-900">24</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
          <h3 className="text-gray-500 text-sm font-semibold">Active Complaints</h3>
          <p className="text-3xl font-bold mt-2">--</p>
        {/* Card 2 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ClipboardList className="w-6 h-6" />
            </div>
          </div>
          <div>
            <h3 className="text-slate-500 text-sm font-medium">Active Complaints</h3>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-4xl font-bold text-slate-900">8</p>
              <span className="text-sm text-slate-500 font-medium">/ 12 resolved</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
          <h3 className="text-gray-500 text-sm font-semibold">Doers Available</h3>
          <p className="text-3xl font-bold mt-2">--</p>
        {/* Card 3 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div>
            <h3 className="text-slate-500 text-sm font-medium">Available Doers</h3>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-4xl font-bold text-slate-900">5</p>
              <span className="text-sm text-slate-500 font-medium">online</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link href="/complaint-form" target="_blank" className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 group-hover:text-blue-700">Open Public Complaint Form</p>
                  <p className="text-xs text-slate-500">Submit a new service request</p>
                </div>
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
            </Link>
            
            {(session?.user.role === "MASTER" || session?.user.role === "ADMIN") && (
              <Link href="/dashboard/users/new" className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 group-hover:text-indigo-700">Add New Team Member</p>
                    <p className="text-xs text-slate-500">Create account for Manager or Doer</p>
                  </div>
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500" />
              </Link>
            )}
          </div>
        </div>

        {/* Recent Activity Placeholder */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Recent Activity</h3>
          <div className="flex flex-col items-center justify-center h-48 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <ClipboardList className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-500">No recent activity yet</p>
            <p className="text-xs text-slate-400 mt-1">Activities will appear here once tasks are updated.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

