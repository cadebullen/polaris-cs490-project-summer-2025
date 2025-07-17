"use client";

import React, { useState, useEffect } from "react";

interface JobAd {
  id: string;
  content: string;
  company: string;
  title: string;
  location: string;
  pay: string;
  overview: string;
  expectations: string;
  submittedAt: string;
}

interface Resume {
  resumeId: string;
  label?: string;
  fileName?: string;
  customName?: string;
  objective?: string;
  createdAt?: string;
  timestamp?: string;
}

const JobAdvice: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [jobAds, setJobAds] = useState<JobAd[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [isLoadingJobAds, setIsLoadingJobAds] = useState(false);
  const [isLoadingResumes, setIsLoadingResumes] = useState(false);
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);
  const [advice, setAdvice] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Get Firebase user
  useEffect(() => {
    import("firebase/auth").then(({ getAuth, onAuthStateChanged }) => {
      const auth = getAuth();
      onAuthStateChanged(auth, (u) => {
        if (u) setUser(u);
      });
    });
  }, []);

  // Fetch job ads when user is available
  useEffect(() => {
    if (user?.uid) {
      setIsLoadingJobAds(true);
      fetch(`/api/jobAd?userId=${user.uid}`)
        .then(res => res.json())
        .then(data => {
          if (data.jobAds) {
            setJobAds(data.jobAds.map((ad: any) => ({
              id: ad.id,
              content: ad.jobText,
              company: ad.company,
              title: ad.title,
              location: ad.location,
              pay: ad.pay,
              overview: ad.overview,
              expectations: ad.expectations,
              submittedAt: new Date(ad.createdAt).toISOString(),
            })));
          }
          setIsLoadingJobAds(false);
        })
        .catch(() => {
          setJobAds([]);
          setIsLoadingJobAds(false);
        });
    }
  }, [user]);

  // Fetch resumes when user is available
  useEffect(() => {
    if (user?.uid) {
      setIsLoadingResumes(true);
      fetch(`/api/saveResume?userId=${user.uid}`)
        .then(res => res.json())
        .then(data => {
          if (data.resumes) {
            setResumes(data.resumes);
          }
          setIsLoadingResumes(false);
        })
        .catch(() => {
          setResumes([]);
          setIsLoadingResumes(false);
        });
    }
  }, [user]);

  const handleGetAdvice = async () => {
    if (!selectedJobId || !selectedResumeId) {
      setError("Please select both a job ad and a resume.");
      return;
    }

    setIsGeneratingAdvice(true);
    setError(null);
    setAdvice([]);

    try {
      // Get Firebase auth token
      const auth = await import("firebase/auth").then(({ getAuth }) => getAuth());
      const token = await auth.currentUser?.getIdToken();

      const response = await fetch("/api/advice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          resumeId: selectedResumeId,
          jobId: selectedJobId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.advice) {
        setAdvice(Array.isArray(data.advice) ? data.advice : [data.advice]);
      } else {
        throw new Error("No advice returned from server");
      }
    } catch (err) {
      setError(
        err instanceof Error 
          ? `Failed to generate advice: ${err.message}` 
          : "Failed to generate advice. Please try again."
      );
    } finally {
      setIsGeneratingAdvice(false);
    }
  };

  const selectedJob = jobAds.find(job => job.id === selectedJobId);
  const selectedResume = resumes.find(resume => resume.resumeId === selectedResumeId);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start py-10 px-4 bg-gradient-to-br from-indigo-200 via-blue-100 to-purple-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 transition-colors duration-500 relative">
      
      {/* Decorative background shapes */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-300/20 dark:bg-indigo-900/20 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-300/20 dark:bg-purple-900/20 rounded-full blur-3xl -z-10 animate-pulse" />
      
      {/* Main Card */}
      <div className="w-full max-w-4xl bg-white/95 dark:bg-gray-900/95 rounded-3xl shadow-2xl p-8 border border-indigo-100 dark:border-gray-800 backdrop-blur-md">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-3 mb-2">
            <span className="text-4xl">💡</span>
            Resume Advice
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Get personalized advice to improve your resume for specific job opportunities
          </p>
        </div>

        {/* Selection Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          {/* Job Ad Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🎯</span>
              <h3 className="text-xl font-semibold text-indigo-700 dark:text-indigo-300">
                Select Job Ad
              </h3>
            </div>
            
            {isLoadingJobAds ? (
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
                Loading job ads...
              </div>
            ) : jobAds.length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400 text-center py-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                No job ads found. Please submit a job ad first.
              </div>
            ) : (
              <select
                className="w-full p-4 rounded-xl border-2 border-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition text-base"
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                aria-label="Select job ad"
              >
                <option value="">Choose a job ad...</option>
                {jobAds.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} @ {job.company} - {job.location}
                  </option>
                ))}
              </select>
            )}

            {/* Selected Job Preview */}
            {selectedJob && (
              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
                  {selectedJob.title}
                </h4>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <p><strong>Company:</strong> {selectedJob.company}</p>
                  <p><strong>Location:</strong> {selectedJob.location}</p>
                  <p><strong>Pay:</strong> {selectedJob.pay}</p>
                  {selectedJob.overview && (
                    <p><strong>Overview:</strong> {selectedJob.overview.slice(0, 150)}...</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Resume Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">📄</span>
              <h3 className="text-xl font-semibold text-indigo-700 dark:text-indigo-300">
                Select Resume
              </h3>
            </div>
            
            {isLoadingResumes ? (
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
                Loading resumes...
              </div>
            ) : resumes.length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400 text-center py-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                No resumes found. Please upload a resume first.
              </div>
            ) : (
              <select
                className="w-full p-4 rounded-xl border-2 border-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition text-base"
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
                aria-label="Select resume"
              >
                <option value="">Choose a resume...</option>
                {resumes.map((resume) => (
                  <option key={resume.resumeId} value={resume.resumeId}>
                    {resume.label || resume.customName || resume.fileName || `Resume ${resume.resumeId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            )}

            {/* Selected Resume Preview */}
            {selectedResume && (
              <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-lg border border-green-200 dark:border-green-700">
                <h4 className="font-semibold text-green-700 dark:text-green-300 mb-2">
                  {selectedResume.label || selectedResume.customName || selectedResume.fileName || "Selected Resume"}
                </h4>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  {selectedResume.objective && (
                    <p><strong>Objective:</strong> {selectedResume.objective.slice(0, 100)}...</p>
                  )}
                  {(selectedResume.timestamp || selectedResume.createdAt) && (
                    <p><strong>Created:</strong> {new Date(selectedResume.timestamp || selectedResume.createdAt!).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Get Advice Button */}
        <div className="flex justify-center mb-8">
          <button
            onClick={handleGetAdvice}
            disabled={!selectedJobId || !selectedResumeId || isGeneratingAdvice}
            className={`px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all duration-200 flex items-center gap-3 ${
              !selectedJobId || !selectedResumeId || isGeneratingAdvice
                ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transform hover:scale-105'
            }`}
          >
            {isGeneratingAdvice ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Generating Advice...
              </>
            ) : (
              <>
                <span className="text-2xl">🎯</span>
                Get Personalized Advice
              </>
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-red-600 dark:text-red-400 text-xl">⚠️</span>
              <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Advice Display */}
        {advice.length > 0 && (
          <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-indigo-900/30 dark:via-gray-800 dark:to-purple-900/30 rounded-2xl p-6 border border-indigo-200 dark:border-indigo-700 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">💡</span>
              <h3 className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                Personalized Advice
              </h3>
            </div>
            
            <div className="space-y-4">
              {advice.map((tip, index) => (
                <div key={index} className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4 border border-indigo-100 dark:border-indigo-700">
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>

            {/* Action buttons for advice */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-indigo-200 dark:border-indigo-700">
              <button
                onClick={() => navigator.clipboard.writeText(advice.join('\n\n'))}
                className="px-4 py-2 rounded-lg bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-700 transition-all flex items-center gap-2"
              >
                <span>📋</span>
                Copy Advice
              </button>
              
              <button
                onClick={() => {
                  setAdvice([]);
                  setSelectedJobId("");
                  setSelectedResumeId("");
                }}
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center gap-2"
              >
                <span>🔄</span>
                Start New Request
              </button>
            </div>
          </div>
        )}

        {/* Instructions/Help */}
        {advice.length === 0 && !isGeneratingAdvice && (
          <div className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/30 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <span>ℹ️</span>
              How it works
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc list-inside">
              <li>Select a job ad that you're interested in applying for</li>
              <li>Choose the resume you want to improve for this specific role</li>
              <li>Click "Get Personalized Advice" to receive AI-powered recommendations</li>
              <li>Review the suggestions and apply them to strengthen your application</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobAdvice;
