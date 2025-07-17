

"use client";

import React, { useState, useEffect, useRef } from "react";
import ThemeToggle from "@/components/ThemeToggle";

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


const JobAdSubmission: React.FC = () => {
  // Stepper state (move this to the top so it's available for all hooks)
  const [currentStep, setCurrentStep] = useState(0);
  const steps = [
    { label: 'Submit Job Ad' },
    { label: 'AI Resume Generation' },
    { label: 'View AI Resume' },
    { label: 'Format' },
    { label: 'Download' },
  ];
  // LaTeX template state
  const [latexTemplateFile, setLatexTemplateFile] = useState<File | null>(null);
  const [latexTemplateContent, setLatexTemplateContent] = useState<string>("");
  const [latexUploadError, setLatexUploadError] = useState<string | null>(null);
  const [latexTemplates, setLatexTemplates] = useState<any[]>([]);
  const [selectedLatexTemplateId, setSelectedLatexTemplateId] = useState<string | null>(null);
  const [isLoadingLatexTemplates, setIsLoadingLatexTemplates] = useState(false);
  const [isFormattingResume, setIsFormattingResume] = useState(false);
  // Fetch LaTeX templates for Format step
  useEffect(() => {
    if (currentStep === 3 && latexTemplates.length === 0 && !isLoadingLatexTemplates) {
      setIsLoadingLatexTemplates(true);
      fetch("/api/templates")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data.templates)) {
            setLatexTemplates(data.templates);
          } else if (Array.isArray(data)) {
            setLatexTemplates(data);
          } else {
            setLatexTemplates([]);
          }
          setIsLoadingLatexTemplates(false);
        })
        .catch(() => {
          setLatexTemplates([]);
          setIsLoadingLatexTemplates(false);
        });
    }
  }, [currentStep, latexTemplates.length, isLoadingLatexTemplates]);
  const [adText, setAdText] = useState("");
  const [ads, setAds] = useState<JobAd[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [previewAd, setPreviewAd] = useState<JobAd | null>(null);
  const [user, setUser] = useState<any>(null);
  const [resumeList, setResumeList] = useState<any[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [selectedJobAdId, setSelectedJobAdId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteAd, setDeleteAd] = useState<JobAd | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [jobUrl, setJobUrl] = useState("");
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [generatingJobAdId, setGeneratingJobAdId] = useState<string | null>(null);
  const [jobAdStatus, setJobAdStatus] = useState<{ [adId: string]: 'idle' | 'processing' | 'completed' }>({});
  const [viewResume, setViewResume] = useState<any | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Persist downloadUrl in sessionStorage so it survives step changes and reloads
  useEffect(() => {
    // Restore downloadUrl if present
    const stored = sessionStorage.getItem("downloadUrl");
    if (stored) setDownloadUrl(stored);
  }, []);
  useEffect(() => {
    if (downloadUrl) {
      sessionStorage.setItem("downloadUrl", downloadUrl);
    } else {
      sessionStorage.removeItem("downloadUrl");
    }
  }, [downloadUrl]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templatePreview, setTemplatePreview] = useState<any | null>(null);
  const [viewResumeUnformatted, setViewResumeUnformatted] = useState<string>("");
  const [isLoadingUnformatted, setIsLoadingUnformatted] = useState(false);
  const [unformattedError, setUnformattedError] = useState<string | null>(null);
  const toastRef = useRef<HTMLDivElement | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  // Add refs for auto-scroll
  const step2Ref = useRef<HTMLDivElement | null>(null);
  const step3Ref = useRef<HTMLDivElement | null>(null);

  // Get Firebase user
  useEffect(() => {
    import("firebase/auth").then(({ getAuth, onAuthStateChanged }) => {
      const auth = getAuth();
      onAuthStateChanged(auth, (u) => {
        if (u) setUser(u);
      });
    });
  }, []);

  // Fetch resumes once user is available
  useEffect(() => {
    if (user?.uid) {
      fetch(`/api/saveResume?userId=${user.uid}`)
        .then(res => res.json())
        .then(data => {
          if (data.resumes) {
            setResumeList(data.resumes);
          }
        });
    }
  }, [user]);

  // Fetch job ads when user is available
  useEffect(() => {
    if (user?.uid) {
      fetch(`/api/jobAd?userId=${user.uid}`)
        .then(res => res.json())
        .then(data => {
          if (data.jobAds) {
            setAds(data.jobAds.map((ad: any) => ({
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
        });
    } else {
      setAds([]);
    }
  }, [user]);

  const handleGenerateAIResume = async () => {
    if (!selectedResumeId) return alert("Please select a resume first.");
    if (!selectedJobAdId) return alert("Please select a job ad.");

    setIsGenerating(true);
    setGeneratingJobAdId(selectedJobAdId); // Set the job ad being generated
    setJobAdStatus(prev => ({ ...prev, [selectedJobAdId]: 'processing' }));
    setSuccessMessage("Resume generation request received! Processing...");
    if (toastRef.current) {
      toastRef.current.style.display = "block";
      setTimeout(() => {
        if (toastRef.current) toastRef.current.style.display = "none";
      }, 2000);
    }

    try {
      const res = await fetch(`/api/saveResume?userId=${user.uid}&resumeId=${selectedResumeId}`);
      const data = await res.json();
      if (!data.resume) {
        setIsGenerating(false);
        setGeneratingJobAdId(null);
        setJobAdStatus(prev => ({ ...prev, [selectedJobAdId]: 'idle' }));
        return alert("Resume not found.");
      }

      const selectedJobAd = ads.find(ad => ad.id === selectedJobAdId);
      if (!selectedJobAd) {
        setIsGenerating(false);
        setGeneratingJobAdId(null);
        setJobAdStatus(prev => ({ ...prev, [selectedJobAdId]: 'idle' }));
        return alert("Selected job ad not found.");
      }

      const jobText = selectedJobAd.content;
      const editableResume = data.resume;

      if (!editableResume || !jobText) {
        setIsGenerating(false);
        setGeneratingJobAdId(null);
        setJobAdStatus(prev => ({ ...prev, [selectedJobAdId]: 'idle' }));
        return alert("Missing required fields.");
      }

      await fetch(`/api/generateResume?unformatted=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobText, editableResume, jobAdId: selectedJobAdId, userId: user.uid }),
      });

      // Start polling for completion
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/generateResume?jobAdId=${selectedJobAdId}&userId=${user.uid}`);
          const pollData = await pollRes.json();
          if (pollData?.status === 'completed') {
            setJobAdStatus(prev => ({ ...prev, [selectedJobAdId]: 'completed' }));
            setIsGenerating(false);
            setGeneratingJobAdId(null);
            setSuccessMessage("AI resume generated successfully!");
            if (pollingRef.current) clearInterval(pollingRef.current);
          } else {
            // Fallback: check if resume is available in /api/saveResume
            const resumeRes = await fetch(`/api/saveResume?userId=${user.uid}&resumeId=${selectedResumeId}`);
            const resumeData = await resumeRes.json();
            if (resumeData?.resume) {
              setJobAdStatus(prev => ({ ...prev, [selectedJobAdId]: 'completed' }));
              setIsGenerating(false);
              setGeneratingJobAdId(null);
              setSuccessMessage("AI resume generated successfully!");
              if (pollingRef.current) clearInterval(pollingRef.current);
            }
          }
        } catch {}
      }, 2000);

    } catch (err) {
      setIsGenerating(false);
      setGeneratingJobAdId(null);
      setJobAdStatus(prev => ({ ...prev, [selectedJobAdId]: 'idle' }));
      alert("Error generating resume.");
    }
  };

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Load existing job ads from localStorage
  useEffect(() => {
    // Remove this effect to prevent localStorage from overwriting ads after backend fetch
    // const stored = localStorage.getItem("jobAds");
    // if (stored) setAds(JSON.parse(stored));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let text = adText.trim();
    if (!text) {
      setMessage("Please paste or type a job ad.");
      return;
    }
    // Simple URL detection
    const urlPattern = /^https?:\/\//i;
    if (urlPattern.test(text)) {
      setIsAdding(true);
      setMessage("Fetching job ad from URL...");
      try {
        const res = await fetch("/api/fetchJobAdFromUrl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: text }),
        });
        const data = await res.json();
        if (data?.jobText) {
          text = data.jobText;
          // Do NOT setAdText(text); // Do not populate the textarea with the extracted job ad
        } else {
          setMessage("Failed to fetch job ad from URL.");
          setIsAdding(false);
          return;
        }
      } catch (err) {
        setMessage("Error fetching job ad from URL.");
        setIsAdding(false);
        return;
      }
    }
    // Now submit the job ad (whether pasted or fetched)
    try {
      const res = await fetch("/api/jobAd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.uid, jobText: text })
      });
      const data = await res.json();
      if (data && data.id) {
        // Fetch the new job ad from backend
        const getRes = await fetch(`/api/jobAd?userId=${user?.uid}`);
        const getData = await getRes.json();
        if (getData.jobAds) {
          setAds(getData.jobAds.map((ad: any) => ({
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
        setMessage("Job ad submitted and parsed successfully!");
        setTimeout(() => setMessage(null), 2000);
        // Auto-scroll to step 2
        setTimeout(() => {
          step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 400);
      } else {
        setMessage("Failed to parse job ad.");
      }
    } catch (err) {
      setMessage("Error submitting job ad.");
    }
    setAdText("");
    setIsAdding(false);
  };

  const handleClearJobAds = () => {
    localStorage.removeItem("jobAds");
    setAds([]);
  };

  // Fetch templates when AI Resume modal opens
  useEffect(() => {
    if (viewResume) {
      setIsLoadingTemplates(true);
      fetch("/api/templates")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data.templates)) {
            setTemplates(data.templates);
          } else if (Array.isArray(data)) {
            setTemplates(data);
          } else {
            setTemplates([]);
          }
          setIsLoadingTemplates(false);
        })
        .catch(() => {
          setTemplates([]);
          setIsLoadingTemplates(false);
        });
    }
  }, [viewResume]);

  // Auto-select most recent job ad and resume when available
  useEffect(() => {
    if (ads.length > 0 && !selectedJobAdId) {
      setSelectedJobAdId(ads[0].id); // Most recent first (assuming sorted)
    }
  }, [ads, selectedJobAdId]);
  useEffect(() => {
    if (resumeList.length > 0 && !selectedResumeId) {
      setSelectedResumeId(resumeList[0].resumeId);
    }
  }, [resumeList, selectedResumeId]);

  // Stepper navigation handlers
  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
  };
  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };


  // Fetch unformatted resume automatically when entering step 2 (View AI Resume) or step 3 (Format)
  useEffect(() => {
    if ((currentStep === 2 || currentStep === 3) && selectedJobAdId && user) {
      setIsLoadingUnformatted(true);
      setUnformattedError(null);
      fetch(`/api/generateResume?jobAdId=${selectedJobAdId}&userId=${user.uid}&unformatted=true`)
        .then(res => res.json())
        .then(data => {
          console.log("Unformatted resume fetch response:", data);
          setViewResumeUnformatted(data.resume || "No unformatted resume available.");
          setIsLoadingUnformatted(false);
        })
        .catch((err) => {
          console.error("Failed to fetch unformatted resume:", err);
          setViewResumeUnformatted("");
          setUnformattedError("Failed to fetch unformatted resume.");
          setIsLoadingUnformatted(false);
        });
    } else if (currentStep === 2 || currentStep === 3) {
      setViewResumeUnformatted("");
      setIsLoadingUnformatted(false);
      setUnformattedError(null);
    }
  }, [currentStep, selectedJobAdId, user]);

  // Auto-format resume with default template when entering Download step if not already formatted
  useEffect(() => {
    const shouldAutoFormat = currentStep === 4 && !downloadUrl && (viewResumeUnformatted || viewResume) && latexTemplates.length > 0;
    if (shouldAutoFormat) {
      let templateId = selectedLatexTemplateId;
      let templateContent = latexTemplateContent;
      if ((!templateId || !templateContent) && latexTemplates.length > 0) {
        templateId = latexTemplates[0].id || latexTemplates[0].templateId;
        templateContent = latexTemplates[0].content || "";
        setSelectedLatexTemplateId(templateId);
        setLatexTemplateContent(templateContent);
      }
      setTimeout(async () => {
        if (!templateContent) return;
        try {
          const res = await fetch("/api/resumes/format", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resume: viewResume || viewResumeUnformatted,
              resumeId: selectedResumeId,
              latexTemplate: templateContent,
              format: "latex-pdf"
            })
          });
          const contentType = res.headers.get('Content-Type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (data.downloadUrl) {
              setDownloadUrl(data.downloadUrl);
              return;
            }
          }
          if (!res.ok) throw new Error("Failed to format resume");
          const blob = await res.blob();
          let filename = "formatted_resume.pdf";
          const disposition = res.headers.get('Content-Disposition');
          if (disposition) {
            const match = disposition.match(/filename="?([^";]+)"?/);
            if (match) filename = match[1];
          }
          const url = window.URL.createObjectURL(blob);
          setDownloadUrl(url);
        } catch {}
      }, 0);
    }
  }, [currentStep, downloadUrl, viewResumeUnformatted, viewResume, latexTemplates, selectedLatexTemplateId, latexTemplateContent, selectedResumeId]);

  return (
    <>
      {/* Theme Toggle in top-right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      {/* Stepper/Progress Bar */}
      <div className="w-full max-w-3xl mx-auto mt-6 mb-8 flex items-center justify-between gap-2">
        {steps.map((step, idx) => (
          <React.Fragment key={step.label}>
            <div className="flex flex-col items-center flex-1">
              <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-lg border-2 transition-all duration-300
                ${idx < currentStep ? 'bg-green-500 border-green-500 text-white' : idx === currentStep ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-gray-200 border-gray-300 text-gray-400'}`}
              >
                {idx < currentStep ? <span>✓</span> : idx + 1}
              </div>
              <span className={`mt-2 text-xs font-semibold text-center ${idx === currentStep ? 'text-indigo-700 dark:text-indigo-300' : idx < currentStep ? 'text-green-600' : 'text-gray-400'}`}>{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-1 ${idx < currentStep ? 'bg-green-400' : 'bg-gray-300'} rounded transition-all duration-300`} />
            )}
          </React.Fragment>
        ))}
      </div>
      {/* Main Container with enhanced background and layout */}
      <div className="min-h-screen w-full flex flex-col items-center justify-start py-10 px-2 bg-gradient-to-br from-indigo-200 via-blue-100 to-purple-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 transition-colors duration-500 relative">
        {/* Decorative background shapes */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-indigo-300/20 dark:bg-indigo-900/20 rounded-full blur-3xl -z-10 animate-float" style={{left: '-6rem', top: '-6rem'}} />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-300/20 dark:bg-purple-900/20 rounded-full blur-3xl -z-10 animate-float2" style={{right: '-8rem', bottom: '-8rem'}} />
        {/* Card container */}
        <div className="w-full max-w-3xl bg-white/95 dark:bg-gray-900/95 rounded-3xl shadow-2xl p-8 border border-indigo-100 dark:border-gray-800 backdrop-blur-md flex flex-col gap-8">
          {/* Step 1: Submit Job Ad & List */}
          {currentStep === 0 && (
            <>
              <h2 className="text-xl font-bold mb-4 text-indigo-700 dark:text-indigo-300 flex items-center gap-2">1. Submit Job Ad</h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-6">
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                  <div className="flex-1">
                    <label className="block mb-2 font-bold text-indigo-700 dark:text-indigo-300 text-lg">Paste link or type a job ad:</label>
                    <textarea
                      className="w-full h-32 p-3 border-2 border-indigo-200 dark:border-gray-700 rounded-xl dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition text-base shadow-sm"
                      value={adText}
                      onChange={e => setAdText(e.target.value)}
                      placeholder="Paste job ad/link here..."
                    />
                  </div>
                  <button
                    type="submit"
                    className="md:w-48 w-full py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 text-white rounded-xl font-bold shadow-lg hover:from-indigo-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition text-lg flex items-center justify-center gap-2"
                    disabled={isAdding}
                  >
                    {isAdding ? (
                      <span className="animate-spin mr-2">🔄</span>
                    ) : (
                      <span role="img" aria-label="submit">📤</span>
                    )}
                    {isAdding ? "Submitting..." : "Submit Job Ad"}
                  </button>
                </div>
                {message && (
                  <div className="mt-1 text-base font-medium text-green-600 dark:text-green-400 text-center">{message}</div>
                )}
              </form>
              {/* Job Ads List as cards (with preview/delete) */}
              <div className="space-y-4">
                {ads.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400 text-center py-8 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl bg-white/70 dark:bg-gray-900/70">
              No job ads submitted yet. You can upload your own .tex file below.
                  </div>
                ) : (
                  <>
                    {ads.map(ad => (
                      <div key={ad.id} className="group p-6 bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center md:justify-between border border-indigo-100 dark:border-gray-700 transition-all hover:scale-[1.02] hover:shadow-2xl relative">
                        {/* Job Ad Content Preview */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-indigo-700 dark:text-indigo-300 truncate max-w-xs" title={ad.title}>{ad.title}</h3>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">@ {ad.company}</span>
                          </div>
                          <div className="flex flex-wrap gap-3 mb-1 text-xs text-gray-500 dark:text-gray-400">
                            <span title="Upload Date & Time">{new Date(ad.submittedAt).toLocaleString()}</span>
                            <span title="Pay" className="font-semibold text-green-700 dark:text-green-300">{ad.pay}</span>
                            <span title="Location">{ad.location}</span>
                          </div>
                          <div className="mb-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-3" title={ad.overview}>{ad.overview || ad.content.slice(0, 180) + (ad.content.length > 180 ? '...' : '')}</div>
                        </div>
                        {/* Actions: Preview / Delete / Status */}
                        <div className="flex flex-col md:flex-row md:items-center md:gap-4 mt-4 md:mt-0">
                          <button
                            onClick={() => {
                              setPreviewAd(ad);
                              setTimeout(() => {
                                const pre = document.getElementById(`preview-content-${ad.id}`);
                                if (pre) pre.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }, 100);
                            }}
                            className="flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white shadow-md hover:bg-indigo-700 transition-all"
                            title="Preview Job Ad"
                          >
                            <span className="mr-2">👁️</span> Preview
                          </button>
                          <button
                            onClick={() => {
                              setDeleteAd(ad);
                              setIsDeleting(true);
                            }}
                            className="flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white shadow-md hover:bg-red-700 transition-all"
                            title="Delete Job Ad"
                          >
                            <span className="mr-2">🗑️</span> Delete
                          </button>
                          <span className={`text-xs mt-2 md:mt-0 ${jobAdStatus[ad.id] === 'completed' ? 'text-green-600' : 'text-gray-400'}`}>
                            {jobAdStatus[ad.id] === 'completed' ? 'AI Resume Ready' : jobAdStatus[ad.id] === 'processing' ? 'Generating AI Resume...' : 'No AI Resume'}
                          </span>
                        </div>
                      </div>
                    ))}
                    {/* Global Preview Modal (not inside map) */}
                    {previewAd && (
                      <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-md">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-2xl relative border border-indigo-200 dark:border-gray-700 overflow-y-auto max-h-[90vh] focus:outline-none" tabIndex={-1}>
                          <button
                            onClick={() => setPreviewAd(null)}
                            className="absolute top-4 right-4 text-gray-600 dark:text-gray-300 hover:text-red-500 text-2xl font-bold"
                            aria-label="Close preview"
                          >×</button>
                          <h3 className="text-lg font-bold mb-4 text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                            <span role="img" aria-label="preview">🔍</span> Job Ad Preview
                          </h3>
                          <div className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                            <div className="font-semibold text-indigo-600 dark:text-indigo-400 mb-2">{previewAd.title}</div>
                            <div className="flex flex-wrap gap-2 mb-2">
                              <span className="text-xs font-medium rounded-full bg-gray-200 dark:bg-gray-800 px-2 py-0.5">{previewAd.company}</span>
                              <span className="text-xs font-medium rounded-full bg-gray-200 dark:bg-gray-800 px-2 py-0.5">{previewAd.location}</span>
                              <span className="text-xs font-medium rounded-full bg-gray-200 dark:bg-gray-800 px-2 py-0.5">{previewAd.pay}</span>
                            </div>
                            <div className="whitespace-pre-wrap break-words max-h-60 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded p-2 bg-gray-50 dark:bg-gray-800">{previewAd.content}</div>
                          </div>
                          {/* AI Resume section (if available) */}
                          {jobAdStatus[previewAd.id] === 'completed' && downloadUrl && (
                            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/30 dark:to-blue-900/30 border border-green-200 dark:border-green-700">
                              <div className="flex items-center mb-3">
                                <span className="text-2xl mr-2">🎉</span>
                                <h4 className="font-bold text-green-800 dark:text-green-200">AI Resume Generated!</h4>
                              </div>
                              <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                                Your personalized resume is ready! Continue to Step 5 for the full download experience, or get it now:
                              </p>
                              <div className="flex items-center space-x-3">
                                <a
                                  href={downloadUrl}
                                  className="inline-flex items-center px-4 py-2 rounded-lg bg-green-600 text-white font-semibold shadow-md hover:bg-green-700 transform hover:scale-105 transition-all"
                                  download="ai-generated-resume.pdf"
                                >
                                  <span className="mr-2">📄</span>
                                  Quick Download
                                </a>
                                <button
                                  onClick={() => window.open(downloadUrl, '_blank')}
                                  className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-all"
                                >
                                  <span className="mr-2">👁️</span>
                                  Preview
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
          {/* Step 2: AI Resume Generation (select resume & job ad, generate) */}
          {currentStep === 1 && (
            <>
              <h2 className="text-xl font-bold mb-4 text-indigo-700 dark:text-indigo-300 flex items-center gap-2">2. AI Resume Generation</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block mb-2 font-bold text-indigo-700 dark:text-indigo-300 text-lg">Choose a Resume:</label>
                  <select
                    className="w-full p-3 rounded-lg border-2 border-indigo-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition mb-2"
                    value={selectedResumeId || ""}
                    onChange={e => setSelectedResumeId(e.target.value)}
                    disabled={resumeList.length === 0}
                    title={resumeList.length === 0 ? 'No resumes available' : ''}
                  >
                    <option value="">Select a resume...</option>
                    {resumeList.map((resume) => (
                      <option key={resume.resumeId} value={resume.resumeId}>
                        {resume.customName || resume.fileName || (resume.objective?.slice(0, 30)) || resume.resumeId}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-2 font-bold text-indigo-700 dark:text-indigo-300 text-lg">Choose a Job Ad:</label>
                  <select
                    className="w-full p-3 rounded-lg border-2 border-indigo-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition mb-2"
                    value={selectedJobAdId}
                    onChange={e => setSelectedJobAdId(e.target.value)}
                    disabled={ads.length === 0}
                    title={ads.length === 0 ? 'No job ads available' : ''}
                  >
                    <option value="">Select a job ad...</option>
                    {ads.map((ad) => (
                      <option key={ad.id} value={ad.id}>
                        {ad.title} {ad.company ? `@ ${ad.company}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleGenerateAIResume}
                disabled={!selectedResumeId || !selectedJobAdId || isGenerating}
                className={`w-full text-white font-bold py-3 px-4 rounded-xl text-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow focus:outline-none focus:ring-2 focus:ring-indigo-400 transition mt-4 ${(!selectedResumeId || !selectedJobAdId || isGenerating) ? "opacity-60 cursor-not-allowed" : ""}`}
                title={!selectedResumeId ? 'Select a resume to continue' : !selectedJobAdId ? 'Select a job ad to continue' : ''}
              >
                {isGenerating ? (
                  <span><span className="animate-spin inline-block mr-2">🔄</span> Processing...</span>
                ) : (
                  <span><span role="img" aria-label="robot">🤖</span> Generate Resume with AI</span>
                )}
              </button>
              {successMessage && (
                <div className="mt-3 text-green-600 font-medium text-base text-center">
                  {successMessage}
                </div>
              )}
            </>
          )}
          {/* Step 3: View AI Resume */}
          {currentStep === 2 && (
            <>
              <h2 className="text-xl font-bold mb-4 text-blue-700 dark:text-blue-300 flex items-center gap-2">3. View AI Resume</h2>
              {isLoadingUnformatted && (
                <div className="mb-4 text-indigo-600 dark:text-indigo-300 flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 mr-2 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                  Loading unformatted resume...
                </div>
              )}
              {unformattedError && (
                <div className="mb-4 text-red-600 dark:text-red-400">{unformattedError}</div>
              )}
              {viewResumeUnformatted && !isLoadingUnformatted && !unformattedError && (
                <div className="mb-4">
                  <div className="font-semibold text-indigo-700 dark:text-indigo-300 mb-1">Unformatted Resume</div>
                  <pre className="text-xs md:text-sm whitespace-pre-wrap break-words bg-gray-50 dark:bg-gray-900 rounded p-4 overflow-x-auto mb-4 border border-indigo-100 dark:border-indigo-700">
                    {viewResumeUnformatted.replace(/\(Note to Applicant: This section is CRUCIAL[\s\S]*?Example Placeholder Project:[\s\S]*?\*\s+Applied computer science and analysis principles to solve moderate-scale data processing and user interaction challenges\.[\s\S]*?\)/g, "")}
                  </pre>
                </div>
              )}
            </>
          )}
          {/* Step 4: Format */}
          {currentStep === 3 && (viewResumeUnformatted || viewResume) && (
            <>
              <h2 className="text-xl font-bold mb-4 text-blue-700 dark:text-blue-300 flex items-center gap-2">4. Format</h2>
              {/* Format Resume Section */}
              <div className="mb-8">
                <h3 className="font-semibold text-indigo-700 dark:text-indigo-300 mb-2 text-lg">Format Resume (LaTeX)</h3>
                <div className="mb-4">
                  <h5 className="font-semibold text-indigo-700 dark:text-indigo-300 mb-2">Choose a LaTeX Template:</h5>
                  {isLoadingLatexTemplates ? (
                    <div className="text-gray-500 dark:text-gray-400">Loading templates...</div>
                  ) : latexTemplates.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
                      {latexTemplates.map((tpl: any) => (
                        <label key={tpl.id || tpl.templateId} className={`relative border rounded-xl p-4 flex flex-col items-center cursor-pointer transition shadow-md hover:shadow-xl bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 ${selectedLatexTemplateId === (tpl.id || tpl.templateId) ? 'border-indigo-500 ring-2 ring-indigo-400' : 'border-gray-200 dark:border-gray-700'}`}>
                          <input
                            type="radio"
                            name="latex-template"
                            className="absolute left-2 top-2"
                            checked={selectedLatexTemplateId === (tpl.id || tpl.templateId)}
                            onChange={() => {
                              setSelectedLatexTemplateId(tpl.id || tpl.templateId);
                              setLatexTemplateContent(tpl.content || "");
                              setLatexTemplateFile(null);
                            }}
                          />
                          {/* Template preview - use live preview API */}
                          <div className="w-40 h-40 flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded mb-2 overflow-hidden">
                            {viewResumeUnformatted ? (
                              <iframe
                                src={`/api/resumePreview?templateId=${encodeURIComponent(tpl.id || tpl.templateId)}&resumeContent=${encodeURIComponent(viewResumeUnformatted)}`}
                                className="w-full h-full border-0 rounded scale-[0.3] origin-top-left"
                                title={`Preview of ${tpl.name || 'Template'}`}
                                style={{ width: '333%', height: '333%' }}
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                                <span className="text-4xl mb-1">📄</span>
                                <span className="text-xs text-center font-medium">Template Preview</span>
                                <span className="text-xs text-center opacity-75">Loading...</span>
                              </div>
                            )}
                          </div>
                          <div className="font-bold text-indigo-700 dark:text-indigo-300 text-base mb-1 text-center line-clamp-2 min-h-[2.5rem]">{tpl.name || 'Untitled Template'}</div>
                          {tpl.description && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 text-center mb-1 line-clamp-3 min-h-[3rem]">{tpl.description}</div>
                          )}
                          {/* Template ID hidden from user */}
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="mt-6 p-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-700">
                  <div className="flex items-center mb-4">
                    <span className="text-2xl mr-2">🎨</span>
                    <h4 className="font-bold text-blue-800 dark:text-blue-200">Choose Your Format</h4>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Select a template above, then click the button below to format your resume. Once formatted, you'll be able to download it in the next step.
                  </p>
                  
                  <div className="flex flex-col space-y-4">
                    <button
                      disabled={isFormattingResume}
                      className={`inline-flex items-center justify-center px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all duration-200 ${
                        isFormattingResume 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-700 hover:to-indigo-800 transform hover:scale-105'
                      }`}
                      onClick={async () => {
                        setIsFormattingResume(true);
                        setDownloadUrl(null);

                        // Only allow selection from the 5 short templates (no fallback to 'ORIGINAL')
                        const allowedTemplateNames = [
                          'Classic',
                          'Modern',
                          'Minimalist',
                          'Sidebar',
                          'Boxed'
                        ];
                        const allowedTemplates = latexTemplates.filter(tpl => allowedTemplateNames.includes(tpl.name));
                        let templateId = selectedLatexTemplateId;
                        let templateContent = latexTemplateContent;
                        if ((!templateId || !templateContent) && allowedTemplates.length > 0) {
                          templateId = allowedTemplates[0].id || allowedTemplates[0].templateId || allowedTemplates[0].name;
                          templateContent = allowedTemplates[0].content || "";
                          setSelectedLatexTemplateId(templateId);
                          setLatexTemplateContent(templateContent);
                        }
                        // If somehow a non-allowed template is selected, force to first allowed
                        if (
                          (!allowedTemplates.find(tpl => (tpl.id || tpl.templateId || tpl.name) === templateId)) &&
                          allowedTemplates.length > 0
                        ) {
                          templateId = allowedTemplates[0].id || allowedTemplates[0].templateId || allowedTemplates[0].name;
                          templateContent = allowedTemplates[0].content || "";
                          setSelectedLatexTemplateId(templateId);
                          setLatexTemplateContent(templateContent);
                        }

                        // Wait for state to update before proceeding (React batching)
                        await new Promise(r => setTimeout(r, 0));

                        try {
                          const res = await fetch("/api/resumes/format-local", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ 
                              templateContent: templateContent,
                              resumeContent: (viewResume || viewResumeUnformatted) || "",
                              templateId: templateId
                            })
                          });
                          if (!res.ok) throw new Error("Failed to format resume");
                          const blob = await res.blob();
                          const url = window.URL.createObjectURL(blob);
                          setDownloadUrl(url);
                          setCurrentStep(4); // Move to download step
                        } catch (err) {
                          alert("Failed to format resume.");
                        } finally {
                          setIsFormattingResume(false);
                        }
                      }}
                    >
                      {isFormattingResume ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-3"></div>
                          Formatting Resume...
                        </>
                      ) : (
                        <>
                          <span className="mr-3">🎨</span>
                          Format Resume
                          <span className="ml-3">➡️</span>
                        </>
                      )}
                    </button>
                    
                    <div className="text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">or</p>
                      <button
                        className="inline-flex items-center px-6 py-3 rounded-lg bg-gradient-to-r from-gray-500 to-gray-600 text-white font-semibold text-sm shadow-md hover:from-gray-600 hover:to-gray-700 transform hover:scale-105 transition-all duration-200"
                        onClick={async () => {
                          setDownloadUrl(null);
                          try {
                            const res = await fetch("/api/resumes/format", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                resume: viewResume || viewResumeUnformatted,
                                resumeId: selectedResumeId,
                                latexTemplate: "", // Empty template will use simple default
                                format: "latex-pdf"
                              })
                            });
                            const contentType = res.headers.get('Content-Type') || '';
                            if (contentType.includes('application/json')) {
                              const data = await res.json();
                              if (data.downloadUrl) {
                                setDownloadUrl(data.downloadUrl);
                                setCurrentStep(4); // Move to download step
                                return;
                              } else {
                                alert("No download URL returned by server.");
                                return;
                              }
                            }
                            if (!res.ok) throw new Error("Failed to format resume");
                            const blob = await res.blob();
                            let filename = "simple_resume.pdf";
                            const disposition = res.headers.get('Content-Disposition');
                            if (disposition) {
                              const match = disposition.match(/filename="?([^";]+)"?/);
                              if (match) filename = match[1];
                            }
                            const url = window.URL.createObjectURL(blob);
                            setDownloadUrl(url);
                            setCurrentStep(4); // Move to download step
                          } catch (err) {
                            alert("Failed to create simple resume.");
                          }
                        }}
                      >
                        <span className="mr-2">📄</span>
                        Skip Formatting & Download Simple
                        <span className="ml-2">⤵️</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          {/* Step 5: Download */}
          {currentStep === 4 && (
            <>
              <h2 className="text-xl font-bold mb-4 text-green-700 dark:text-green-300 flex items-center gap-2">5. Download</h2>
              <div className="mb-4 flex flex-col items-center">
                <h3 className="font-semibold text-green-700 dark:text-green-300 mb-4 text-lg">Your Resume is Ready!</h3>
                {downloadUrl ? (
                  <div className="flex flex-col items-center space-y-4">
                    {/* Primary download button */}
                    <a
                      href={downloadUrl}
                      className="inline-flex items-center px-8 py-4 rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white font-bold text-xl shadow-lg hover:from-green-700 hover:to-green-800 transform hover:scale-105 transition-all duration-200"
                      download="resume.pdf"
                      onClick={(e) => {
                        // Trigger actual download when clicked
                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.download = 'resume.pdf';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        e.preventDefault(); // Prevent default link behavior
                      }}
                    >
                      <span className="mr-3 text-2xl">📄</span>
                      Download My Resume
                      <span className="ml-3 text-2xl">⬇️</span>
                    </a>
                    
                    {/* Secondary options */}
                    <div className="flex flex-col items-center space-y-2">
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => window.open(downloadUrl, '_blank')}
                          className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-all"
                        >
                          <span className="mr-2">👁️</span>
                          Preview in Browser
                        </button>
                        
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(downloadUrl);
                              alert('Download link copied to clipboard!');
                            } catch {
                              alert('Could not copy link. Please use the download button above.');
                            }
                          }}
                          className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                        >
                          <span className="mr-2">📋</span>
                          Copy Link
                        </button>
                      </div>
                      
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-md">
                        <strong>Having trouble downloading?</strong><br/>
                        Try right-clicking the download button and selecting "Save link as..." or use the preview option above.
                      </p>
                    </div>
                    
                    {/* Success message */}
                    <div className="mt-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 max-w-md">
                      <div className="flex items-center">
                        <span className="text-green-600 dark:text-green-400 mr-2">✅</span>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          <strong>Success!</strong> Your resume has been formatted and is ready for download.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-4">
                    {/* Loading animation */}
                    <div className="flex items-center space-x-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                      <span className="text-lg text-gray-600 dark:text-gray-400">Formatting your resume...</span>
                    </div>
                    
                    <div className="text-center max-w-md">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        We're using professional LaTeX formatting to create a beautiful PDF. This usually takes 10-30 seconds.
                      </p>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full animate-pulse w-3/5"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          {/* Stepper Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <button
              className="px-6 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              onClick={handleBack}
              disabled={currentStep === 0}
            >Back</button>
            {currentStep !== 4 && currentStep !== 3 && (
              <button
                className="px-6 py-2 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
                onClick={handleNext}
                disabled={
                  (currentStep === 0 && ads.length === 0) ||
                  (currentStep === 1 && (!selectedResumeId || !selectedJobAdId || isGenerating || jobAdStatus[selectedJobAdId] !== 'completed')) ||
                  (currentStep === 2 && !viewResumeUnformatted && !viewResume)
                  // Note: Step 3 (format) should use "Format Resume" button instead of Next button
                }
              >Next</button>
            )}
          </div>
        </div>
        {/* Toast notification for immediate feedback */}
        <div ref={toastRef} style={{display: 'none'}} className="fixed top-8 left-1/2 transform -translate-x-1/2 z-[200] bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg font-semibold text-lg transition-all">
          Resume generation request received! Processing...
        </div>
        {/* AI Resume Modal */}
        {viewResume && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-2xl w-full relative border border-blue-200 dark:border-blue-700 overflow-y-auto max-h-[90vh]">
              <button
                onClick={() => setViewResume(null)}
                className="absolute top-2 right-2 text-gray-600 dark:text-gray-300 hover:text-red-500 text-2xl font-bold"
                aria-label="Close AI resume modal"
              >×</button>
              <h4 className="text-xl font-bold mb-4 text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <span role="img" aria-label="robot">🤖</span> AI Generated Resume
              </h4>
              <pre className="text-xs md:text-sm whitespace-pre-wrap break-words bg-gray-100 dark:bg-gray-800 rounded p-4 overflow-x-auto mb-4">
                {JSON.stringify(viewResume, null, 2)}
              </pre>
              {/* Template selection UI */}
              <div className="mb-4">
                <h5 className="font-semibold text-indigo-700 dark:text-indigo-300 mb-2">Choose a Resume Template:</h5>
                {isLoadingTemplates ? (
                  <div className="text-gray-500 dark:text-gray-400">Loading templates...</div>
                ) : templates.length === 0 ? (
                  <div className="text-gray-500 dark:text-gray-400">No templates available. Default will be used.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {templates.map((tpl: any) => (
                      <div
                        key={tpl.id || tpl.templateId}
                        className={`relative border rounded-xl p-4 flex flex-col items-center cursor-pointer transition shadow-md hover:shadow-xl bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 ${selectedTemplateId === (tpl.id || tpl.templateId) ? 'border-indigo-500 ring-2 ring-indigo-400' : 'border-gray-200 dark:border-gray-700'}`}
                        onClick={() => setSelectedTemplateId(tpl.id || tpl.templateId)}
                        tabIndex={0}
                        role="button"
                        aria-pressed={selectedTemplateId === (tpl.id || tpl.templateId)}
                      >
                        {selectedTemplateId === (tpl.id || tpl.templateId) && (
                          <span className="absolute top-2 right-2 text-green-600 dark:text-green-400 text-lg" title="Selected">✔️</span>
                        )}
                        {/* Template preview - use live preview API */}
                        <div className="w-28 h-28 flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded mb-2 overflow-hidden">
                          {viewResume ? (
                            <iframe
                              src={`/api/resumePreview?templateId=${encodeURIComponent(tpl.id || tpl.templateId)}&resumeContent=${encodeURIComponent(JSON.stringify(viewResume))}`}
                              className="w-full h-full border-0 rounded scale-[0.2] origin-top-left"
                              title={`Preview of ${tpl.name || 'Template'}`}
                              style={{ width: '500%', height: '500%' }}
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                              <span className="text-2xl mb-1">📄</span>
                              <span className="text-xs text-center font-medium">Template</span>
                            </div>
                          )}
                        </div>
                        <div className="font-bold text-indigo-700 dark:text-indigo-300 text-base mb-1 text-center line-clamp-2 min-h-[2.5rem]">{tpl.name || 'Untitled Template'}</div>
                        {tpl.description && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 text-center mb-1 line-clamp-3 min-h-[3rem]">{tpl.description}</div>
                        )}
                        <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">{tpl.id || tpl.templateId}</div>
                        <button
                          className="mt-auto px-3 py-1 rounded bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 text-xs font-semibold hover:bg-blue-200 dark:hover:bg-blue-700 transition"
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setTemplatePreview(tpl);
                          }}
                        >Preview</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="mt-2 px-5 py-2 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition shadow"
                onClick={async () => {
                  setDownloadUrl(null);
                  // TODO: Integrate backend call to generate LaTeX .tex file and compile to PDF
                  // For now, fallback to existing formatting logic
                  try {
                    const res = await fetch("/api/resumes/format", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        resume: viewResume,
                        resumeId: selectedResumeId,
                        templateId: selectedTemplateId || undefined, // fallback to default if not selected
                        format: "pdf" // Explicitly request PDF output
                      })
                    });
                    // Try to parse JSON for downloadUrl
                    const contentType = res.headers.get('Content-Type') || '';
                    if (contentType.includes('application/json')) {
                      const data = await res.json();
                      if (data.downloadUrl) {
                        setDownloadUrl(data.downloadUrl);
                        return;
                      } else {
                        alert("No download URL returned by server.");
                        return;
                      }
                    }
                    // Fallback: blob download
                    if (!res.ok) throw new Error("Failed to format resume");
                    const blob = await res.blob();
                    let filename = "formatted_resume.pdf";
                    const disposition = res.headers.get('Content-Disposition');
                    if (disposition) {
                      const match = disposition.match(/filename="?([^";]+)"?/);
                      if (match) filename = match[1];
                    }
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    }, 100);
                  } catch (err) {
                    alert("Failed to format and download resume.");
                  }
                }}
              >Format Resume & Download</button>
            </div>
          </div>
        )}
        {/* Template Preview Modal */}
        {templatePreview && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-lg w-full relative border border-blue-200 dark:border-blue-700 overflow-y-auto max-h-[90vh] animate-fade-in">
              <button
                onClick={() => setTemplatePreview(null)}
                className="absolute top-2 right-2 text-gray-600 dark:text-gray-300 hover:text-red-500 text-2xl font-bold"
                aria-label="Close template preview"
              >×</button>
              <h4 className="text-lg font-bold mb-2 text-blue-700 dark:text-blue-300 text-center">{templatePreview.name || 'Untitled Template'}</h4>
              {templatePreview.imageUrl ? (
                <img src={templatePreview.imageUrl} alt={templatePreview.name} className="w-48 h-48 object-contain mx-auto mb-4 rounded shadow" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded mb-4 text-gray-400 text-6xl mx-auto">📄</div>
              )}
              {templatePreview.description && (
                <div className="text-sm text-gray-700 dark:text-gray-300 mb-2 text-center">{templatePreview.description}</div>
              )}
              <div className="text-xs text-gray-400 dark:text-gray-500 text-center mb-2">{templatePreview.id || templatePreview.templateId}</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default JobAdSubmission;

