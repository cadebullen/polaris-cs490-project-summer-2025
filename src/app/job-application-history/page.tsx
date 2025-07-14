"use client";
import React, { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import SidePanel from "@/components/sidePanel";
import TopBanner from "@/components/topBanner";

type Application = {
  id: string;
  title: string;
  company: string;
  createdAt: number;
  jobText?: string;
  location?: string;
  pay?: string;
  overview?: string;
  expectations?: string;
};

export default function JobApplicationHistoryPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      setUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/jobAd?userId=${userId}`)
      .then((res) => res.json())
      .then((data) => {
        setApplications(data.jobAds || []);
        setLoading(false);
      });
  }, [userId]);

  const handleForceHome = () => {
    window.location.href = "/home";
  };
  const handleToggleSidePanel = () => {
    setIsSidePanelOpen((prev) => !prev);
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-indigo-100 via-white to-blue-100 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 transition-colors duration-500">
      <SidePanel isSidePanelOpen={isSidePanelOpen} onForceHome={handleForceHome} onClose={() => setIsSidePanelOpen(false)} />
      <div className="flex-1 flex flex-col min-h-screen">
        <TopBanner toggleSidePanel={handleToggleSidePanel} onForceHome={handleForceHome} />
        <main className="flex-1 flex flex-col items-center justify-start py-10 px-2">
          <div className="w-full max-w-7xl bg-white/90 dark:bg-gray-900/90 rounded-2xl shadow-2xl p-8 border border-indigo-100 dark:border-gray-800 backdrop-blur-md">
            <h1 className="text-3xl font-extrabold mb-8 text-indigo-700 dark:text-indigo-300 tracking-tight flex items-center gap-3">
              <span role="img" aria-label="history">📜</span> Job Application History
            </h1>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <span className="animate-spin text-3xl text-indigo-500 mr-3">🔄</span>
                <span className="text-gray-700 dark:text-gray-300 text-lg">Loading...</span>
              </div>
            ) : applications.length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400 text-center py-12 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-white/60 dark:bg-gray-900/60">
                You have not applied to any jobs yet.
              </div>
            ) : (
              <>
                {/* Card list for mobile, table for md+ */}
                <div className="block md:hidden space-y-6">
                  {applications.map((app) => (
                    <div key={app.id} className="bg-white/90 dark:bg-gray-900/90 rounded-xl shadow border border-indigo-100 dark:border-gray-700 p-5 flex flex-col gap-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-indigo-600 dark:text-indigo-300 text-xl">💼</span>
                        <span className="font-bold text-lg text-indigo-800 dark:text-indigo-200">{app.title}</span>
                      </div>
                      <div className="text-gray-700 dark:text-gray-300"><span className="font-semibold">Company:</span> {app.company}</div>
                      <div className="text-gray-700 dark:text-gray-300"><span className="font-semibold">Date:</span> {app.createdAt ? new Date(app.createdAt).toLocaleString() : ""}</div>
                      {app.location && <div className="text-gray-700 dark:text-gray-300"><span className="font-semibold">Location:</span> {app.location}</div>}
                      {app.pay && <div className="text-gray-700 dark:text-gray-300 truncate"><span className="font-semibold">Pay:</span> {app.pay}</div>}
                      {app.overview && <div className="text-gray-700 dark:text-gray-300"><span className="font-semibold">Overview:</span> {app.overview}</div>}
                      {app.expectations && <div className="text-gray-700 dark:text-gray-300"><span className="font-semibold">Expectations:</span> {app.expectations}</div>}
                      <button
                        className="mt-2 w-fit px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 text-white rounded-lg font-bold shadow hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition text-base"
                        onClick={() => setSelectedApp(app)}
                      >
                        View Details
                      </button>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full bg-white dark:bg-gray-800 rounded-xl shadow border border-indigo-100 dark:border-gray-700">
                    <thead>
                      <tr className="bg-indigo-50 dark:bg-gray-800">
                        <th className="py-3 px-5 text-left font-semibold text-indigo-700 dark:text-indigo-300">Job Title</th>
                        <th className="py-3 px-5 text-left font-semibold text-indigo-700 dark:text-indigo-300">Company</th>
                        <th className="py-3 px-5 text-left font-semibold text-indigo-700 dark:text-indigo-300">Date Applied</th>
                        <th className="py-3 px-5 text-left font-semibold text-indigo-700 dark:text-indigo-300">Location</th>
                        <th className="py-3 px-5 text-left font-semibold text-indigo-700 dark:text-indigo-300">Pay</th>
                        <th className="py-3 px-5 text-left font-semibold text-indigo-700 dark:text-indigo-300">Overview</th>
                        <th className="py-3 px-5 text-left font-semibold text-indigo-700 dark:text-indigo-300">Expectations</th>
                        <th className="py-3 px-5 text-left font-semibold text-indigo-700 dark:text-indigo-300">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((app, idx) => (
                        <tr key={app.id} className={`border-t border-gray-200 dark:border-gray-700 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-indigo-50 dark:bg-gray-800'}`}>
                          <td className="py-3 px-5 font-medium text-gray-900 dark:text-gray-100">{app.title}</td>
                          <td className="py-3 px-5 text-gray-700 dark:text-gray-300">{app.company}</td>
                          <td className="py-3 px-5 text-gray-700 dark:text-gray-300">{app.createdAt ? new Date(app.createdAt).toLocaleString() : ""}</td>
                          <td className="py-3 px-5 text-gray-700 dark:text-gray-300">{app.location || "-"}</td>
                          <td className="py-3 px-5 text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{app.pay || "-"}</td>
                          <td className="py-3 px-5 text-gray-700 dark:text-gray-300">{app.overview ? app.overview.slice(0, 40) + (app.overview.length > 40 ? '...' : '') : "-"}</td>
                          <td className="py-3 px-5 text-gray-700 dark:text-gray-300">{app.expectations ? app.expectations.slice(0, 40) + (app.expectations.length > 40 ? '...' : '') : "-"}</td>
                          <td className="py-3 px-5">
                            <button
                              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-blue-400 rounded transition"
                              onClick={() => setSelectedApp(app)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Modal for details */}
          {selectedApp && (
            <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 w-full max-w-2xl border border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[80vh] relative mt-16 mb-4 animate-fade-in">
                <button
                  className="absolute top-2 right-2 text-gray-600 dark:text-gray-300 hover:text-red-500 text-2xl font-bold"
                  onClick={() => setSelectedApp(null)}
                  aria-label="Close preview"
                >
                  ×
                </button>
                <h2 className="text-2xl font-bold mb-3 text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                  <span role="img" aria-label="briefcase">💼</span> {selectedApp.title}
                </h2>
                <div className="mb-2 text-base text-gray-700 dark:text-gray-300"><span className="font-semibold">Company:</span> {selectedApp.company}</div>
                <div className="mb-2 text-base text-gray-700 dark:text-gray-300"><span className="font-semibold">Date Applied:</span> {selectedApp.createdAt ? new Date(selectedApp.createdAt).toLocaleString() : ""}</div>
                {selectedApp.location && <div className="mb-2 text-base text-gray-700 dark:text-gray-300"><span className="font-semibold">Location:</span> {selectedApp.location}</div>}
                {selectedApp.pay && <div className="mb-2 text-base text-gray-700 dark:text-gray-300"><span className="font-semibold">Pay:</span> {selectedApp.pay}</div>}
                {selectedApp.overview && <div className="mb-2 text-base text-gray-700 dark:text-gray-300"><span className="font-semibold">Overview:</span> {selectedApp.overview}</div>}
                {selectedApp.expectations && <div className="mb-2 text-base text-gray-700 dark:text-gray-300"><span className="font-semibold">Expectations:</span> {selectedApp.expectations}</div>}
                {/* {selectedApp.jobText && (
                  <div className="mt-2">
                    <span className="font-semibold">Full Job Description:</span>
                    <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1 overflow-x-auto overflow-y-auto max-h-64">
                      {selectedApp.jobText}
                    </pre>
                  </div>
                )} */}
                <button
                  className="mt-6 px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 text-white rounded-lg font-bold shadow hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition text-lg"
                  onClick={() => setSelectedApp(null)}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}