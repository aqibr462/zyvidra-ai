/* =========================================================
   ZYVIDRA — COMPLETE WEBSITE SCRIPT
   Authentication, video requests, uploads, customer dashboard,
   and administrator dashboard.
   ========================================================= */

"use strict";

/* ===================== CONFIGURATION ===================== */

const SUPABASE_URL = "https://laixvuhoyozespdsypke.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_UwBjXqHLTs1Oy3wkFz3NlQ_JwRC4heT";
const STORAGE_BUCKET = "zyvidra-files";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const SITE_URL = "https://aqibr462.github.io/zyvidra-ai/";

/* ===================== SUPABASE CLIENT ===================== */

if (!window.supabase?.createClient) {
  throw new Error(
    "Supabase library failed to load. Check your internet connection and script tags."
  );
}

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

/* ===================== HTML ELEMENTS ===================== */

const authPanel = document.getElementById("authPanel");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authMessage = document.getElementById("authMessage");

const loginButton = document.getElementById("loginButton");
const signupButton = document.getElementById("signupButton");
const logoutButton = document.getElementById("logoutButton");

const requestForm = document.getElementById("requestForm");
const creationMode = document.getElementById("creationMode");
const promptInput = document.getElementById("prompt");
const charCount = document.getElementById("charCount");

const ratioInput = document.getElementById("ratio");
const durationInput = document.getElementById("duration");
const styleInput = document.getElementById("style");
const audioInput = document.getElementById("audio");
const useCaseInput = document.getElementById("useCase");

const referenceInput = document.getElementById("reference");
const firstFrameInput = document.getElementById("firstFrame");
const lastFrameInput = document.getElementById("lastFrame");
const referenceVideoInput = document.getElementById("referenceVideo");

const imagePreview = document.getElementById("imagePreview");
const previewImg = document.getElementById("previewImg");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const removeImageButton = document.getElementById("removeImage");
const uploadTitle = document.getElementById("uploadTitle");
const uploadHint = document.getElementById("uploadHint");

const formMessage = document.getElementById("formMessage");
const successDialog = document.getElementById("successDialog");
const successText = document.getElementById("successText");
const closeDialog = document.getElementById("closeDialog");

const dashboardPanel = document.getElementById("dashboardPanel");
const dashboardMessage = document.getElementById("dashboardMessage");
const requestList = document.getElementById("requestList");
const refreshRequests = document.getElementById("refreshRequests");

const adminPanel = document.getElementById("adminPanel");
const adminMessage = document.getElementById("adminMessage");
const adminRequestList = document.getElementById("adminRequestList");
const refreshAdminRequests = document.getElementById("refreshAdminRequests");

/* ===================== APPLICATION STATE ===================== */

let currentSession = null;
let isSubmitting = false;
let isAdmin = false;
let customerLoadId = 0;
let adminLoadId = 0;

/* ===================== GENERAL HELPERS ===================== */

function setMessage(element, message, isError = false) {
  if (!element) return;

  element.textContent = message;
  element.hidden = !message;
  element.classList.toggle("error", isError);
}

function makeElement(tag, className = "", text = "") {
  const element = document.createElement(tag);

  if (className) element.className = className;

  if (text !== undefined && text !== null) {
    element.textContent = String(text);
  }

  return element;
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString();
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "";

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getCustomerName(user) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Customer"
  );
}

function getStatusLabel(status, hasVideo = false) {
  switch (status) {
    case "pending":
      return "In Queue";

    case "in_progress":
      return "Generating Video";

    case "completed":
      return hasVideo
        ? "Ready to Download"
        : "Completed — Awaiting Delivery Link";

    case "rejected":
      return "Not Approved";

    default:
      return status || "Pending";
  }
}

function safeHttpUrl(value) {
  if (!value || typeof value !== "string") return null;

  try {
    const url = new URL(value.trim());

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function getFile(input) {
  return input?.files?.[0] || null;
}

function validateFile(file, allowedTypes, label) {
  if (!file) return null;

  if (file.size > MAX_FILE_SIZE) {
    return `${label} must be smaller than 50 MB.`;
  }

  if (allowedTypes.length && !allowedTypes.includes(file.type)) {
    return `${label} has an unsupported file type.`;
  }

  return null;
}

function makeSafeFileName(name) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(-120);

  return cleaned || "upload";
}

function getSelectedModel() {
  return (
    document.querySelector('input[name="model"]:checked')?.value ||
    "Veo 3"
  );
}

function getCreationMode() {
  return creationMode?.value || "text_to_video";
}

/* ===================== AUTHENTICATION UI ===================== */

function updateAccountUI(session) {
  currentSession = session || null;

  const signedIn = Boolean(currentSession?.user);

  if (authPanel) authPanel.hidden = signedIn;
  if (requestForm) requestForm.hidden = !signedIn;
  if (logoutButton) logoutButton.hidden = !signedIn;
  if (loginButton) loginButton.hidden = signedIn;
  if (signupButton) signupButton.hidden = signedIn;

  if (dashboardPanel) dashboardPanel.hidden = !signedIn;

  if (signedIn) {
    setMessage(
      authMessage,
      `Signed in as ${currentSession.user.email || "customer"}.`
    );
  } else {
    isAdmin = false;

    if (adminPanel) adminPanel.hidden = true;
    if (adminRequestList) adminRequestList.replaceChildren();

    setMessage(
      authMessage,
      "Sign in or create an account to submit video requests."
    );
  }

  updateUploadFields();
}

async function signUp() {
  const name = authName?.value.trim() || "";
  const email = authEmail?.value.trim() || "";
  const password = authPassword?.value || "";

  if (!email || !password) {
    setMessage(authMessage, "Enter your email and password.", true);
    return;
  }

  if (password.length < 6) {
    setMessage(
      authMessage,
      "Your password must contain at least 6 characters.",
      true
    );
    return;
  }

  if (signupButton) signupButton.disabled = true;

  setMessage(authMessage, "Creating your account...");

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: SITE_URL
      }
    });

    if (error) throw error;

    if (data.session) {
      updateAccountUI(data.session);

      setMessage(
        authMessage,
        "Account created and signed in successfully."
      );

      await refreshDashboards();
    } else {
      setMessage(
        authMessage,
        "Account created. Check your email if confirmation is required, then sign in."
      );
    }
  } catch (error) {
    setMessage(
      authMessage,
      error.message || "Could not create your account.",
      true
    );
  } finally {
    if (signupButton) signupButton.disabled = false;
  }
}

async function signIn() {
  const email = authEmail?.value.trim() || "";
  const password = authPassword?.value || "";

  if (!email || !password) {
    setMessage(authMessage, "Enter your email and password.", true);
    return;
  }

  if (loginButton) loginButton.disabled = true;

  setMessage(authMessage, "Signing in...");

  try {
    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    updateAccountUI(data.session);

    setMessage(authMessage, "Signed in successfully.");

    await refreshDashboards();
  } catch (error) {
    setMessage(
      authMessage,
      error.message || "Sign-in failed.",
      true
    );
  } finally {
    if (loginButton) loginButton.disabled = false;
  }
}

async function signOut() {
  if (logoutButton) logoutButton.disabled = true;

  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) throw error;

    currentSession = null;
    isAdmin = false;

    updateAccountUI(null);

    if (requestList) requestList.replaceChildren();
    if (adminRequestList) adminRequestList.replaceChildren();

    setMessage(authMessage, "You have signed out.");
    setMessage(dashboardMessage, "");
    setMessage(adminMessage, "");
  } catch (error) {
    setMessage(
      authMessage,
      error.message || "Could not sign out.",
      true
    );
  } finally {
    if (logoutButton) logoutButton.disabled = false;
  }
}

loginButton?.addEventListener("click", signIn);
signupButton?.addEventListener("click", signUp);
logoutButton?.addEventListener("click", signOut);

authPassword?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    signIn();
  }
});

/* ===================== UPLOAD MODE SWITCHING ===================== */

function setInputVisibility(input, visible) {
  if (!input) return;

  input.hidden = !visible;
  input.disabled = !visible;
  input.required = visible;
}

function updateUploadFields() {
  const mode = getCreationMode();

  const referenceZone = referenceInput?.closest(".upload-zone");
  const extraFields = document.querySelector(".extra-upload-fields");

  const firstFrameLabel = document.querySelector('label[for="firstFrame"]');
  const lastFrameLabel = document.querySelector('label[for="lastFrame"]');
  const videoLabel = document.querySelector('label[for="referenceVideo"]');

  const showReference = mode === "reference_media";

  const showFirstFrame =
    mode === "first_frame" || mode === "first_last_frame";

  const showLastFrame = mode === "first_last_frame";
  const showReferenceVideo = mode === "reference_media";

  if (referenceZone) referenceZone.hidden = !showReference;

  if (extraFields) {
    extraFields.hidden = !(
      showFirstFrame || showLastFrame || showReferenceVideo
    );
  }

  setInputVisibility(firstFrameInput, showFirstFrame);
  setInputVisibility(lastFrameInput, showLastFrame);
  setInputVisibility(referenceVideoInput, showReferenceVideo);

  if (firstFrameLabel) firstFrameLabel.hidden = !showFirstFrame;
  if (lastFrameLabel) lastFrameLabel.hidden = !showLastFrame;
  if (videoLabel) videoLabel.hidden = !showReferenceVideo;

  if (referenceInput) {
    referenceInput.disabled = !showReference;
    referenceInput.required = false;
  }

  if (uploadTitle) {
    uploadTitle.textContent = showReference
      ? "Choose a reference image"
      : "Choose an image";
  }

  if (uploadHint) {
    uploadHint.textContent = "PNG, JPG or WEBP · maximum 50 MB";
  }

  if (!showReference && referenceInput) {
    referenceInput.value = "";
  }

  if (!showFirstFrame && firstFrameInput) {
    firstFrameInput.value = "";
  }

  if (!showLastFrame && lastFrameInput) {
    lastFrameInput.value = "";
  }

  if (!showReferenceVideo && referenceVideoInput) {
    referenceVideoInput.value = "";
  }

  if (!showReference && imagePreview) {
    imagePreview.hidden = true;

    if (previewImg) previewImg.removeAttribute("src");
    if (fileName) fileName.textContent = "";
    if (fileSize) fileSize.textContent = "";
  }
}

creationMode?.addEventListener("change", updateUploadFields);

/* ===================== IMAGE PREVIEW ===================== */

function showImagePreview(file) {
  if (!file || !imagePreview || !previewImg) return;

  if (!file.type.startsWith("image/")) {
    setMessage(formMessage, "Please select an image file.", true);
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    setMessage(formMessage, "Image must be smaller than 50 MB.", true);
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    previewImg.src = String(reader.result || "");
    imagePreview.hidden = false;

    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = formatFileSize(file.size);
  };

  reader.onerror = () => {
    setMessage(formMessage, "Could not preview this image.", true);
  };

  reader.readAsDataURL(file);
}

referenceInput?.addEventListener("change", () => {
  const file = getFile(referenceInput);

  if (file) {
    showImagePreview(file);
  } else if (imagePreview) {
    imagePreview.hidden = true;
  }
});

removeImageButton?.addEventListener("click", () => {
  if (referenceInput) referenceInput.value = "";
  if (previewImg) previewImg.removeAttribute("src");
  if (imagePreview) imagePreview.hidden = true;
  if (fileName) fileName.textContent = "";
  if (fileSize) fileSize.textContent = "";
});

/* ===================== PROMPT CHARACTER COUNT ===================== */

function updateCharacterCount() {
  if (!promptInput || !charCount) return;

  charCount.textContent = `${promptInput.value.length} / 2000`;
}

promptInput?.addEventListener("input", updateCharacterCount);

/* ===================== FILE UPLOAD ===================== */

async function uploadFile(file, userId, label) {
  if (!file) return null;

  const error = validateFile(file, [], label);

  if (error) throw new Error(error);

  const safeName = makeSafeFileName(file.name);

  const uniqueId =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const path = `${userId}/${Date.now()}_${uniqueId}_${safeName}`;

  const { error: uploadError } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream"
    });

  if (uploadError) throw uploadError;

  return path;
}

/* ===================== REQUEST VALIDATION ===================== */

function validateRequestFiles(mode) {
  const referenceFile = getFile(referenceInput);
  const firstFrameFile = getFile(firstFrameInput);
  const lastFrameFile = getFile(lastFrameInput);
  const referenceVideoFile = getFile(referenceVideoInput);

  if (mode === "first_frame" && !firstFrameFile) {
    return "Please upload the first-frame image.";
  }

  if (mode === "first_last_frame") {
    if (!firstFrameFile) {
      return "Please upload the first-frame image.";
    }

    if (!lastFrameFile) {
      return "Please upload the last-frame image.";
    }
  }

  if (
    mode === "reference_media" &&
    !referenceFile &&
    !referenceVideoFile
  ) {
    return "Please upload a reference image or reference video.";
  }

  const checks = [
    [
      referenceFile,
      ["image/jpeg", "image/png", "image/webp"],
      "Reference image"
    ],
    [
      firstFrameFile,
      ["image/jpeg", "image/png", "image/webp"],
      "First frame"
    ],
    [
      lastFrameFile,
      ["image/jpeg", "image/png", "image/webp"],
      "Last frame"
    ],
    [
      referenceVideoFile,
      ["video/mp4", "video/webm"],
      "Reference video"
    ]
  ];

  for (const [file, types, label] of checks) {
    const error = validateFile(file, types, label);

    if (error) return error;
  }

  return null;
}

/* ===================== REQUEST SUBMISSION ===================== */

async function submitVideoRequest(event) {
  event.preventDefault();

  if (isSubmitting) return;

  if (!currentSession?.user) {
    setMessage(
      formMessage,
      "Please sign in before submitting a request.",
      true
    );
    return;
  }

  const user = currentSession.user;
  const prompt = promptInput?.value.trim() || "";
  const mode = getCreationMode();

  if (prompt.length < 10) {
    setMessage(
      formMessage,
      "Please describe your video in at least 10 characters.",
      true
    );

    promptInput?.focus();
    return;
  }

  const fileError = validateRequestFiles(mode);

  if (fileError) {
    setMessage(formMessage, fileError, true);
    return;
  }

  const referenceFile = getFile(referenceInput);
  const firstFrameFile = getFile(firstFrameInput);
  const lastFrameFile = getFile(lastFrameInput);
  const referenceVideoFile = getFile(referenceVideoInput);

  isSubmitting = true;

  const submitButton = requestForm?.querySelector('[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
  }

  setMessage(
    formMessage,
    "Uploading files and submitting your request..."
  );

  try {
    const referencePath = await uploadFile(
      referenceFile,
      user.id,
      "Reference image"
    );

    const firstFramePath = await uploadFile(
      firstFrameFile,
      user.id,
      "First frame"
    );

    const lastFramePath = await uploadFile(
      lastFrameFile,
      user.id,
      "Last frame"
    );

    const referenceVideoPath = await uploadFile(
      referenceVideoFile,
      user.id,
      "Reference video"
    );

    const durationSeconds =
      parseInt(durationInput?.value || "8", 10) || 8;

    /*
      ASPECT-RATIO FIX:
      The database accepts only 16:9, 9:16, and 1:1.
      Remove descriptive labels such as " — Portrait"
      before inserting the request into Supabase.
    */

    const selectedRatio = ratioInput?.value || "9:16";
    const aspectRatio = selectedRatio.split(" — ")[0].trim();

    const allowedRatios = ["16:9", "9:16", "1:1"];

    if (!allowedRatios.includes(aspectRatio)) {
      throw new Error(
        `Unsupported aspect ratio: "${selectedRatio}". Please select 16:9, 9:16, or 1:1.`
      );
    }

    const payload = {
      user_id: user.id,
      customer_name: getCustomerName(user),
      email: user.email || null,
      model: getSelectedModel(),
      prompt,
      duration_seconds: durationSeconds,
      aspect_ratio: aspectRatio,
      visual_style: styleInput?.value || null,
      audio_preference: audioInput?.value || null,
      intended_platform: useCaseInput?.value || null,
      creation_mode: mode,
      reference_image_path: referencePath,
      first_frame_path: firstFramePath,
      last_frame_path: lastFramePath,
      reference_video_path: referenceVideoPath,
      status: "pending",
      final_video_url: null
    };

    /*
      Insert without requesting the inserted row back.
      Display the actual Supabase error if submission fails.
    */

    const { error } = await supabaseClient
      .from("video_requests")
      .insert(payload);

    if (error) {
      console.error("Supabase submission error:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });

      throw new Error(
        `Submission failed: ${error.message} (Code: ${error.code || "unknown"})`
      );
    }

    
setMessage(formMessage, "");

if (successText) {
  successText.textContent =
    "Your request has been received successfully.";
  successText.hidden = false;
}

if (successDialog?.showModal) {
  successDialog.showModal();
} else if (successDialog) {
  successDialog.hidden = false;
}


    requestForm.reset();

    if (imagePreview) imagePreview.hidden = true;
    if (previewImg) previewImg.removeAttribute("src");
    if (fileName) fileName.textContent = "";
    if (fileSize) fileSize.textContent = "";

    updateCharacterCount();
    updateUploadFields();

    await refreshDashboards();
  } catch (error) {
    console.error("Request submission error:", error);

    setMessage(
      formMessage,
      error.message || "Could not submit your request. Please try again.",
      true
    );
  } finally {
    isSubmitting = false;

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Submit Video Request";
    }
  }
}

requestForm?.addEventListener("submit", submitVideoRequest);

closeDialog?.addEventListener("click", () => {
  if (successDialog?.close) {
    successDialog.close();
  } else if (successDialog) {
    successDialog.hidden = true;
  }
});

/* ===================== CUSTOMER DASHBOARD ===================== */

async function loadCustomerRequests() {
  const loadId = ++customerLoadId;

  if (!dashboardPanel || !requestList || !dashboardMessage) return;

  if (!currentSession?.user) {
    dashboardPanel.hidden = true;
    requestList.replaceChildren();
    return;
  }

  dashboardPanel.hidden = false;

  setMessage(dashboardMessage, "Loading your requests...");
  requestList.replaceChildren();

  try {
    const { data: requests, error } = await supabaseClient
      .from("video_requests")
      .select(
        "id,created_at,model,prompt,duration_seconds,aspect_ratio,status,final_video_url"
      )
      .eq("user_id", currentSession.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (loadId !== customerLoadId) return;

    requestList.replaceChildren();

    if (!requests || requests.length === 0) {
      setMessage(
        dashboardMessage,
        "No requests yet. Submit your first video request using the form above."
      );

      return;
    }

    setMessage(
      dashboardMessage,
      `You have ${requests.length} video request${requests.length === 1 ? "" : "s"}.`
    );

    requests.forEach((request) => {
      requestList.append(renderCustomerRequest(request));
    });
  } catch (error) {
    console.error("Customer dashboard error:", error);

    if (loadId === customerLoadId) {
      setMessage(
        dashboardMessage,
        error.message || "Could not load your requests. Please refresh.",
        true
      );
    }
  }
}

function renderCustomerRequest(request) {
  const card = makeElement("article", "request-card");

  const videoUrl =
    request.status === "completed"
      ? safeHttpUrl(request.final_video_url)
      : null;

  card.append(
    makeElement(
      "h3",
      "request-model",
      request.model || "Video request"
    ),
    makeElement(
      "p",
      "request-date",
      `Submitted: ${formatDate(request.created_at)}`
    ),
    makeElement(
      "p",
      "request-details",
      `Duration: ${request.duration_seconds ?? "—"} seconds · Ratio: ${request.aspect_ratio || "—"}`
    ),
    makeElement(
      "p",
      "request-status",
      `Status: ${getStatusLabel(request.status, Boolean(videoUrl))}`
    ),
    makeElement("p", "request-prompt", request.prompt || "")
  );

  if (videoUrl) {
    const link = makeElement(
      "a",
      "button primary",
      "Download / Watch Video"
    );

    link.href = videoUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    card.append(link);
  }

  return card;
}

refreshRequests?.addEventListener("click", loadCustomerRequests);

/* ===================== ADMIN DASHBOARD ===================== */

async function loadAdminRequests() {
  const loadId = ++adminLoadId;

  if (!adminPanel || !adminRequestList || !adminMessage) return;

  adminPanel.hidden = true;
  isAdmin = false;

  adminRequestList.replaceChildren();

  if (!currentSession?.user) return;

  setMessage(adminMessage, "Verifying administrator access...");

  if (refreshAdminRequests) {
    refreshAdminRequests.disabled = true;
  }

  try {
    const { data: roleData, error: roleError } =
      await supabaseClient.rpc("is_zyvidra_admin");

    if (roleError) throw roleError;

    if (loadId !== adminLoadId) return;

    if (roleData !== true) {
      setMessage(
        adminMessage,
        "This account does not have administrator access."
      );

      return;
    }

    isAdmin = true;
    adminPanel.hidden = false;

    setMessage(adminMessage, "Loading all video requests...");

    const { data: requests, error } = await supabaseClient
      .from("video_requests")
      .select(
        "id,created_at,model,prompt,duration_seconds,aspect_ratio,status,final_video_url,customer_name,email,user_id,creation_mode,visual_style,audio_preference,intended_platform,reference_image_path,first_frame_path,last_frame_path,reference_video_path"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (loadId !== adminLoadId) return;

    adminRequestList.replaceChildren();

    if (!requests || requests.length === 0) {
      setMessage(
        adminMessage,
        "No video requests have been submitted yet."
      );

      return;
    }

    setMessage(
      adminMessage,
      `${requests.length} total request${requests.length === 1 ? "" : "s"}.`
    );

    requests.forEach((request) => {
      adminRequestList.append(renderAdminRequest(request));
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);

    if (loadId === adminLoadId) {
      isAdmin = false;
      adminPanel.hidden = false;

      adminRequestList.replaceChildren();

      setMessage(
        adminMessage,
        `Could not load the admin dashboard: ${error.message || "Check permissions."}`,
        true
      );
    }
  } finally {
    if (loadId === adminLoadId && refreshAdminRequests) {
      refreshAdminRequests.disabled = false;
    }
  }
}

function renderAdminRequest(request) {
  const card = makeElement("article", "request-card");

  card.append(
    makeElement(
      "h3",
      "request-model",
      request.model || "Video request"
    ),
    makeElement(
      "p",
      "request-date",
      `Submitted: ${formatDate(request.created_at)}`
    ),
    makeElement(
      "p",
      "request-details",
      `Customer: ${request.customer_name || "Customer"}`
    ),
    makeElement(
      "p",
      "request-details",
      `Email: ${request.email || "Not provided"}`
    ),
    makeElement(
      "p",
      "request-details",
      `Request ID: ${request.id}`
    ),
    makeElement(
      "p",
      "request-details",
      `Creation mode: ${request.creation_mode || "—"}`
    ),
    makeElement(
      "p",
      "request-details",
      `Duration: ${request.duration_seconds ?? "—"} seconds · Ratio: ${request.aspect_ratio || "—"}`
    ),
    makeElement(
      "p",
      "request-details",
      `Style: ${request.visual_style || "—"} · Audio: ${request.audio_preference || "—"} · Platform: ${request.intended_platform || "—"}`
    ),
    makeElement(
      "h4",
      "request-detail-heading",
      "Customer prompt"
    ),
    makeElement(
      "p",
      "request-prompt",
      request.prompt || "No prompt supplied."
    )
  );

  const uploadedFiles = [
    ["Reference image", request.reference_image_path],
    ["First frame", request.first_frame_path],
    ["Last frame", request.last_frame_path],
    ["Reference video", request.reference_video_path]
  ];

  uploadedFiles.forEach(([label, path]) => {
    if (path) {
      card.append(
        makeElement("p", "request-details", `${label}: ${path}`)
      );
    }
  });

  card.append(
    makeElement("h4", "request-detail-heading", "Update request")
  );

  const statusLabel = makeElement("label", "", "Request status");
  const statusSelect = document.createElement("select");

  statusSelect.setAttribute("aria-label", "Request status");

  const statuses = [
    ["pending", "Pending — in queue"],
    ["in_progress", "In progress — generating"],
    ["completed", "Completed"],
    ["rejected", "Rejected"]
  ];

  statuses.forEach(([value, label]) => {
    const option = document.createElement("option");

    option.value = value;
    option.textContent = label;

    statusSelect.append(option);
  });

  statusSelect.value = statuses.some(
    ([value]) => value === request.status
  )
    ? request.status
    : "pending";

  statusLabel.append(statusSelect);
  card.append(statusLabel);

  const videoLabel = makeElement("label", "", "Final video URL");
  const videoInput = document.createElement("input");

  videoInput.type = "url";
  videoInput.placeholder = "https://example.com/video.mp4";
  videoInput.value = request.final_video_url || "";
  videoInput.autocomplete = "url";

  videoLabel.append(videoInput);
  card.append(videoLabel);

  const saveButton = makeElement(
    "button",
    "button primary",
    "Save Changes"
  );

  saveButton.type = "button";

  const saveMessage = makeElement("p", "request-note", "");

  saveMessage.setAttribute("role", "status");

  saveButton.addEventListener("click", async () => {
    if (!currentSession?.user || !isAdmin) {
      setMessage(
        saveMessage,
        "Administrator access is required.",
        true
      );

      return;
    }

    const newStatus = statusSelect.value;
    const rawUrl = videoInput.value.trim();
    const videoUrl = rawUrl ? safeHttpUrl(rawUrl) : null;

    if (rawUrl && !videoUrl) {
      setMessage(
        saveMessage,
        "Enter a valid HTTP or HTTPS video URL.",
        true
      );

      return;
    }

    if (newStatus === "completed" && !videoUrl) {
      setMessage(
        saveMessage,
        "Add a valid video URL before marking the request completed.",
        true
      );

      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    setMessage(saveMessage, "Saving changes...");

    try {
      const { error } = await supabaseClient
        .from("video_requests")
        .update({
          status: newStatus,
          final_video_url: videoUrl
        })
        .eq("id", request.id);

      if (error) throw error;

      setMessage(saveMessage, "Changes saved successfully.");

      await refreshDashboards();
    } catch (error) {
      console.error("Admin update error:", error);

      setMessage(
        saveMessage,
        `Could not save: ${error.message || "Database update failed."}`,
        true
      );
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save Changes";
    }
  });

  card.append(saveButton, saveMessage);

  return card;
}

refreshAdminRequests?.addEventListener("click", loadAdminRequests);

/* ===================== DASHBOARD REFRESH ===================== */

async function refreshDashboards() {
  if (!currentSession?.user) return;

  await Promise.allSettled([
    loadCustomerRequests(),
    loadAdminRequests()
  ]);
}

/* ===================== AUTH STATE LISTENER ===================== */

supabaseClient.auth.onAuthStateChange((_event, session) => {
  updateAccountUI(session);

  if (session?.user) {
    window.setTimeout(() => {
      if (currentSession?.user?.id === session.user.id) {
        refreshDashboards();
      }
    }, 0);
  } else {
    customerLoadId++;
    adminLoadId++;

    isAdmin = false;

    if (requestList) requestList.replaceChildren();
    if (adminRequestList) adminRequestList.replaceChildren();

    setMessage(dashboardMessage, "");
    setMessage(adminMessage, "");
  }
});

/* ===================== INITIAL PAGE SETUP ===================== */

async function initializeZyvidra() {
  updateCharacterCount();
  updateUploadFields();

  if (dashboardPanel) dashboardPanel.hidden = true;
  if (adminPanel) adminPanel.hidden = true;

  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    updateAccountUI(data.session);

    if (data.session?.user) {
      await refreshDashboards();
    }
  } catch (error) {
    console.error("Zyvidra initialization error:", error);

    updateAccountUI(null);

    setMessage(
      authMessage,
      "Could not initialize your account session. Refresh the page and try again.",
      true
    );
  }

  const yearElement = document.getElementById("year");

  if (yearElement) {
    yearElement.textContent = String(new Date().getFullYear());
  }
}

initializeZyvidra();
