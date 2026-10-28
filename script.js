
const SUPABASE_URL = "https://laixvuhoyozespdsypke.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xYeFxzpmdmuEK76sG181tw_2hB_jB63";
const STORAGE_BUCKET = "zyvidra-files";
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const form = document.getElementById("requestForm");
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

document.getElementById("year").textContent = new Date().getFullYear();

promptInput.addEventListener("input", () => {
  charCount.textContent = `${promptInput.value.length} / 2000`;
});

function showError(message) {
  formMessage.textContent = message;
  formMessage.hidden = false;
}

function clearImage() {
  imagePreview.hidden = true;
  previewImg.removeAttribute("src");
  fileName.textContent = "";
  fileSize.textContent = "";
  uploadTitle.textContent = "Choose an image or drop it here";
  uploadHint.textContent = "PNG, JPG or WEBP · maximum 8 MB in this demo";
}

referenceInput.addEventListener("change", () => {
  formMessage.hidden = true;
  const file = referenceInput.files?.[0];

  if (!file) {
    clearImage();
    return;
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    showError("Reference images must be JPG, PNG, or WEBP.");
    referenceInput.value = "";
    clearImage();
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    showError("The reference image must be smaller than 50 MB.");
    referenceInput.value = "";
    clearImage();
    return;
  }

  previewImg.src = URL.createObjectURL(file);
  fileName.textContent = file.name;
  fileSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
  imagePreview.hidden = false;
  uploadTitle.textContent = "Reference image selected";
  uploadHint.textContent = "Remove the image or choose another one";
});

document.getElementById("removeImage").addEventListener("click", () => {
  referenceInput.value = "";
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

async function uploadFile(file, requestId, fieldName) {
  if (!file) return null;

  const path =
    `requests/${requestId}/${fieldName}-${crypto.randomUUID()}.${getExtension(file)}`;

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");

  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${encodedPath}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
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
      `Could not upload ${file.name} (${response.status}). Please try again.`
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.hidden = true;

  if (
    !SUPABASE_URL.startsWith("https://") ||
    !SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_")
  ) {
    showError("Supabase configuration is missing or invalid.");
    return;
  }

  const data = new FormData(form);
  const customerName = String(data.get("customerName") || "").trim();
  const email = String(data.get("email") || "").trim();
  const prompt = promptInput.value.trim();
  const creationMode = String(data.get("creationMode") || "text_to_video");
  const durationValue = String(data.get("duration") || "");
  const durationMatch = durationValue.match(/\d+/);
  const duration = durationMatch ? Number(durationMatch[0]) : NaN;

  const referenceImage = referenceInput.files?.[0] || null;
  const firstFrame = firstFrameInput.files?.[0] || null;
  const lastFrame = lastFrameInput.files?.[0] || null;
  const referenceVideo = referenceVideoInput.files?.[0] || null;

  const submitButton = form.querySelector('[type="submit"]');
  const originalButtonText = submitButton.textContent;

  try {
    if (!customerName || !email || !prompt) {
      throw new Error("Please enter your name, email, and video prompt.");
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

    if (creationMode === "first_last_frame" && (!firstFrame || !lastFrame)) {
      throw new Error("Please select both a first-frame and a last-frame image.");
    }

    if (creationMode === "reference_media" && !referenceImage && !referenceVideo) {
      throw new Error("Please select a reference image or video.");
    }

    validateFile(referenceImage, "image");
    validateFile(firstFrame, "image");
    validateFile(lastFrame, "image");
    validateFile(referenceVideo, "video");

    if (!document.getElementById("rights").checked) {
      throw new Error("Please confirm you have permission to use your files.");
    }

    submitButton.disabled = true;
    submitButton.textContent = "Uploading and submitting...";

    const requestId = crypto.randomUUID();

    const referenceImagePath = await uploadFile(
      referenceImage, requestId, "reference-image"
    );

    const firstFramePath = await uploadFile(
      firstFrame, requestId, "first-frame"
    );

    const lastFramePath = await uploadFile(
      lastFrame, requestId, "last-frame"
    );

    const referenceVideoPath = await uploadFile(
      referenceVideo, requestId, "reference-video"
    );

    const request = {
      id: requestId,
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
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify(request)
      }
    );

    if (!response.ok) {
      const details = await response.text();
      console.error("Request submission error:", response.status, details);
      throw new Error(
        `Request submission failed (${response.status}). Tell me this code so we can fix it.`
      );
    }

    document.getElementById("successText").textContent =
      "Your request has been submitted successfully and is pending review.";

    form.reset();
    clearImage();
    charCount.textContent = "0 / 2000";
    dialog.showModal();

  } catch (error) {
    showError(error.message || "Something went wrong. Please try again.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
  }
});

document.getElementById("closeDialog").addEventListener("click", () => {
  dialog.close();
});

const zone = document.querySelector(".upload-zone");

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
    if (!file) return;

    const transfer = new DataTransfer();
    transfer.items.add(file);
    referenceInput.files = transfer.files;
    referenceInput.dispatchEvent(new Event("change"));
  });
}
