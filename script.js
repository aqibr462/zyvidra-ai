
const SUPABASE_URL = "https://laixvuhoyozespdsypke.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_UwBjXqHLTs1Oy3wkFz3NlQ_JwRC4heT";
const STORAGE_BUCKET = "zyvidra-files";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const SITE_URL = "https://aqibr462.github.io/zyvidra-ai/";

const form = document.getElementById("requestForm");
const authPanel = document.getElementById("authPanel");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authMessage = document.getElementById("authMessage");

const loginButton = document.getElementById("loginButton");
const signupButton = document.getElementById("signupButton");
const logoutButton = document.getElementById("logoutButton");

const promptInput = document.getElementById("prompt");
const referenceInput = document.getElementById("reference");
const firstFrameInput = document.getElementById("firstFrame");
const lastFrameInput = document.getElementById("lastFrame");
const referenceVideoInput = document.getElementById("referenceVideo");

const imagePreview = document.getElementById("imagePreview");
const previewImg = document.getElementById("previewImg");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const uploadTitle = document.getElementById("uploadTitle");
const uploadHint = document.getElementById("uploadHint");
const charCount = document.getElementById("charCount");

const dialog = document.getElementById("successDialog");
const formMessage = document.getElementById("formMessage");
const zone = document.querySelector(".upload-zone");
const creationModeSelect = document.getElementById("creationMode");
const extraUploadFields = document.querySelector(".extra-upload-fields");
const extraUploadHint =
  extraUploadFields?.querySelector(".field-hint");

const yearElement = document.getElementById("year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

if (!window.supabase?.createClient) {
  if (authMessage) {
    authMessage.textContent =
      "Unable to load the account system. Refresh the page and try again.";
  }
  throw new Error("Supabase library was not loaded.");
}

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

let currentSession = null;

function showAuthMessage(message) {
  if (authMessage) authMessage.textContent = message;
}

function showError(message) {
  if (!formMessage) return;
  formMessage.textContent = message;
  formMessage.hidden = false;
}

function clearImage() {
  if (imagePreview) imagePreview.hidden = true;
  if (previewImg) previewImg.removeAttribute("src");
  if (fileName) fileName.textContent = "";
  if (fileSize) fileSize.textContent = "";

  if (uploadTitle) {
    uploadTitle.textContent = "Choose an image or drop it here";
  }

  if (uploadHint) {
    uploadHint.textContent =
      "PNG, JPG or WEBP · maximum 50 MB";
  }
}

function getCustomerName(user) {
  const metadata = user?.user_metadata || {};

  return String(
    metadata.full_name ||
    metadata.name ||
    user?.email?.split("@")[0] ||
    "Customer"
  ).trim();
}

function updateAccountUI(session) {
  currentSession = session;
  const signedIn = Boolean(session?.user);

  if (authPanel) authPanel.hidden = signedIn;
  if (form) form.hidden = !signedIn;
  if (logoutButton) logoutButton.hidden = !signedIn;
  if (loginButton) loginButton.hidden = signedIn;
  if (signupButton) signupButton.hidden = signedIn;

  if (signedIn) {
    showAuthMessage("You are signed in.");
  }

  updateUploadFields();
}

async function getCurrentSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) throw error;

  updateAccountUI(data.session);
}

if (loginButton) {
  loginButton.addEventListener("click", async () => {
    showAuthMessage("");

    const email = authEmail?.value.trim() || "";
    const password = authPassword?.value || "";

    if (!email || !password) {
      showAuthMessage("Enter your email and password.");
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";

    try {
      const { data, error } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;

      updateAccountUI(data.session);
      if (authPassword) authPassword.value = "";
      showAuthMessage("Signed in successfully.");
    } catch (error) {
      showAuthMessage(error.message || "Sign-in failed.");
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "Sign In";
    }
  });
}

if (signupButton) {
  signupButton.addEventListener("click", async () => {
    showAuthMessage("");

    const name = authName?.value.trim() || "";
    const email = authEmail?.value.trim() || "";
    const password = authPassword?.value || "";

    if (!name) {
      showAuthMessage("Enter your full name.");
      return;
    }

    if (!email || !password) {
      showAuthMessage("Enter your email and password.");
      return;
    }

    if (password.length < 8) {
      showAuthMessage("Use a password with at least 8 characters.");
      return;
    }

    signupButton.disabled = true;
    signupButton.textContent = "Creating account...";

    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: SITE_URL,
          data: {
            full_name: name
          }
        }
      });

      if (error) throw error;

      if (data.session) {
        updateAccountUI(data.session);
        if (authPassword) authPassword.value = "";
        showAuthMessage("Your account is ready.");
      } else {
        showAuthMessage(
          "Account created. If email confirmation is enabled, verify your email before signing in."
        );
      }
    } catch (error) {
      showAuthMessage(error.message || "Account creation failed.");
    } finally {
      signupButton.disabled = false;
      signupButton.textContent = "Create Account";
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;

      updateAccountUI(null);
      showAuthMessage("You have signed out.");
    } catch (error) {
      showAuthMessage(error.message || "Sign-out failed.");
    } finally {
      logoutButton.disabled = false;
    }
  });
}

supabaseClient.auth.onAuthStateChange((_event, session) => {
  updateAccountUI(session);
});

if (promptInput && charCount) {
  promptInput.addEventListener("input", () => {
    charCount.textContent = `${promptInput.value.length} / 2000`;
  });
}

if (referenceInput) {
  referenceInput.addEventListener("change", () => {
    if (formMessage) formMessage.hidden = true;

    const file = referenceInput.files?.[0];

    if (!file) {
      clearImage();
      return;
    }

    try {
      validateFile(file, "image");
    } catch (error) {
      showError(error.message);
      referenceInput.value = "";
      clearImage();
      return;
    }

    if (previewImg) previewImg.src = URL.createObjectURL(file);
    if (fileName) fileName.textContent = file.name;
    if (fileSize) {
      fileSize.textContent =
        `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    }

    if (imagePreview) imagePreview.hidden = false;
    if (uploadTitle) uploadTitle.textContent = "Reference image selected";
    if (uploadHint) {
      uploadHint.textContent = "Remove the image or choose another one";
    }
  });
}

document.getElementById("removeImage")?.addEventListener("click", () => {
  if (referenceInput) referenceInput.value = "";
  clearImage();
});

function validateFile(file, kind) {
  if (!file) return;

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${file.name} exceeds the 50 MB limit.`);
  }

  const allowedTypes = kind === "video"
    ? ["video/mp4", "video/webm"]
    : ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      kind === "video"
        ? "Reference videos must be MP4 or WEBM."
        : "Images must be JPG, PNG, or WEBP."
    );
  }
}

function getExtension(file) {
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm"
  };

  return extensions[file.type];
}

async function uploadFile(file, userId, requestId, fieldName, token) {
  if (!file) return null;

  const extension = getExtension(file);

  if (!extension) {
    throw new Error(`Unsupported file type: ${file.name}`);
  }

  const path =
    `${userId}/requests/${requestId}/${fieldName}-${crypto.randomUUID()}.${extension}`;

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");

  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${encodedPath}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": file.type,
        "x-upsert": "false"
      },
      body: file
    }
  );

  if (!response.ok) {
    const details = await response.text();
    console.error("Storage upload error:", response.status, details);
    throw new Error(
      `Could not upload ${file.name} (${response.status}).`
    );
  }

  return path;
}

function normalizeModel(value) {
  return value === "Omni Flash" ? "Omni Flash" : "Veo 3";
}

function normalizeRatio(value) {
  const ratio = String(value || "");

  if (ratio.includes("9:16")) return "9:16";
  if (ratio.includes("1:1")) return "1:1";

  return "16:9";
}

function setFieldVisibility(input, visible) {
  if (!input) return;

  input.hidden = !visible;

  const label = input.previousElementSibling;
  if (label?.tagName === "LABEL") {
    label.hidden = !visible;
  }
}

function updateUploadFields() {
  if (!creationModeSelect) return;

  const mode = creationModeSelect.value;
  const showFirst =
    mode === "first_frame" || mode === "first_last_frame";
  const showLast = mode === "first_last_frame";
  const showReference = mode === "reference_media";

  setFieldVisibility(firstFrameInput, showFirst);
  setFieldVisibility(lastFrameInput, showLast);
  setFieldVisibility(referenceVideoInput, showReference);

  if (extraUploadFields) {
    extraUploadFields.hidden =
      !showFirst && !showLast && !showReference;
  }

  if (extraUploadHint) {
    extraUploadHint.hidden =
      !showFirst && !showLast && !showReference;
  }

  if (zone) zone.hidden = !showReference;

  if (!showReference) {
    if (referenceInput) referenceInput.value = "";
    clearImage();
    if (referenceVideoInput) referenceVideoInput.value = "";
  }

  if (!showFirst && firstFrameInput) firstFrameInput.value = "";
  if (!showLast && lastFrameInput) lastFrameInput.value = "";
}

creationModeSelect?.addEventListener("change", updateUploadFields);

if (zone) {
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.style.borderColor = "#a78bfa";
  });

  zone.addEventListener("dragleave", () => {
    zone.style.borderColor = "";
  });

  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.style.borderColor = "";

    const file = event.dataTransfer.files?.[0];
    if (!file || !referenceInput) return;

    const transfer = new DataTransfer();
    transfer.items.add(file);
    referenceInput.files = transfer.files;
    referenceInput.dispatchEvent(new Event("change"));
  });
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (formMessage) formMessage.hidden = true;

    const submitButton = form.querySelector('[type="submit"]');
    const originalButtonText =
      submitButton?.textContent || "Create request";

    try {
      const { data: sessionData, error: sessionError } =
        await supabaseClient.auth.getSession();

      if (sessionError) throw sessionError;

      const session = sessionData.session;

      if (!session?.user || !session.access_token) {
        throw new Error("Please sign in before submitting a request.");
      }

      const user = session.user;
      const data = new FormData(form);
      const prompt = promptInput?.value.trim() || "";
      const creationMode = String(
        data.get("creationMode") || "text_to_video"
      );
      const durationValue = String(data.get("duration") || "");
      const durationMatch = durationValue.match(/\d+/);
      const duration = durationMatch ? Number(durationMatch[0]) : NaN;

      const referenceImage = referenceInput?.files?.[0] || null;
      const firstFrame = firstFrameInput?.files?.[0] || null;
      const lastFrame = lastFrameInput?.files?.[0] || null;
      const referenceVideo = referenceVideoInput?.files?.[0] || null;

      // Use the saved name when present. Older accounts may not have one.
      const customerName = getCustomerName(user);
      const email = String(user.email || "").trim();

      if (!email) {
        throw new Error(
          "Your account email could not be found. Please sign out and sign in again."
        );
      }

      if (prompt.length < 10 || prompt.length > 2000) {
        throw new Error("Your prompt must contain 10–2000 characters.");
      }

      if (![8, 10].includes(duration)) {
        throw new Error("Please select 8 seconds or 10 seconds.");
      }

      if (![
        "text_to_video",
        "first_frame",
        "first_last_frame",
        "reference_media"
      ].includes(creationMode)) {
        throw new Error("Please select a valid video creation mode.");
      }

      if (creationMode === "first_frame" && !firstFrame) {
        throw new Error("Please select a first-frame image.");
      }

      if (
        creationMode === "first_last_frame" &&
        (!firstFrame || !lastFrame)
      ) {
        throw new Error("Please select both frame images.");
      }

      if (
        creationMode === "reference_media" &&
        !referenceImage &&
        !referenceVideo
      ) {
        throw new Error("Please select a reference image or video.");
      }

      validateFile(referenceImage, "image");
      validateFile(firstFrame, "image");
      validateFile(lastFrame, "image");
      validateFile(referenceVideo, "video");

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Uploading and submitting...";
      }

      const requestId = crypto.randomUUID();
      const token = session.access_token;

      const referenceImagePath = await uploadFile(
        referenceImage, user.id, requestId, "reference-image", token
      );

      const firstFramePath = await uploadFile(
        firstFrame, user.id, requestId, "first-frame", token
      );

      const lastFramePath = await uploadFile(
        lastFrame, user.id, requestId, "last-frame", token
      );

      const referenceVideoPath = await uploadFile(
        referenceVideo, user.id, requestId, "reference-video", token
      );

      const request = {
        id: requestId,
        user_id: user.id,
        model: normalizeModel(data.get("model")),
        prompt,
        duration_seconds: duration,
        aspect_ratio: normalizeRatio(data.get("ratio")),
        visual_style: String(data.get("style") || ""),
        audio_preference: String(data.get("audio") || ""),
        intended_platform: String(data.get("useCase") || ""),
        customer_name: customerName,
        email,
        creation_mode: creationMode,
        reference_image_path: referenceImagePath,
        first_frame_path: firstFramePath,
        last_frame_path: lastFramePath,
        reference_video_path: referenceVideoPath,
        status: "pending",
        final_video_url: null
      };

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/video_requests`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },
          body: JSON.stringify(request)
        }
      );

      if (!response.ok) {
        const details = await response.text();
        console.error(
          "Request submission error:",
          response.status,
          details
        );

        throw new Error(
          `Request submission failed (${response.status}). Please report this code.`
        );
      }

      const successText = document.getElementById("successText");

      if (successText) {
        successText.textContent =
          "Your request has been submitted and is pending review. Video generation does not start automatically.";
      }

      form.reset();
      clearImage();

      if (charCount) charCount.textContent = "0 / 2000";

      updateUploadFields();

      if (dialog?.showModal) {
        dialog.showModal();
      } else {
        alert("Your video request has been submitted and is pending review.");
      }
    } catch (error) {
      console.error("Video request error:", error);
      showError(error.message || "Something went wrong. Please try again.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  });
}

document.getElementById("closeDialog")?.addEventListener("click", () => {
  dialog?.close();
});

if (form) form.hidden = true;
if (authPanel) authPanel.hidden = false;
if (logoutButton) logoutButton.hidden = true;

updateUploadFields();

getCurrentSession().catch((error) => {
  console.error("Session initialization failed:", error);
  showAuthMessage(
    "Unable to check your sign-in. Refresh the page and try again."
  );
});
