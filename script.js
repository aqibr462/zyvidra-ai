
const SUPABASE_URL = "https://laixvuhoyozespdsypke.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xYeFxzpmdmuEK76sG181tw_2hB_jB63";

const form = document.getElementById("requestForm");
const referenceInput = document.getElementById("reference");
const imagePreview = document.getElementById("imagePreview");
const previewImg = document.getElementById("previewImg");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const uploadTitle = document.getElementById("uploadTitle");
const uploadHint = document.getElementById("uploadHint");
const promptInput = document.getElementById("prompt");
const charCount = document.getElementById("charCount");
const dialog = document.getElementById("successDialog");
const formMessage = document.getElementById("formMessage");

let selectedImageData = null;

document.getElementById("year").textContent = new Date().getFullYear();

promptInput.addEventListener("input", () => {
  charCount.textContent = `${promptInput.value.length} / 2000`;
});

referenceInput.addEventListener("change", () => {
  const file = referenceInput.files?.[0];
  formMessage.hidden = true;

  if (!file) {
    clearImage();
    return;
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    showError("Please select a JPG, PNG, or WEBP image.");
    referenceInput.value = "";
    clearImage();
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    showError("Please choose an image smaller than 8 MB.");
    referenceInput.value = "";
    clearImage();
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    selectedImageData = reader.result;
    previewImg.src = selectedImageData;
    fileName.textContent = file.name;
    fileSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    imagePreview.hidden = false;
    uploadTitle.textContent = "Reference image selected";
    uploadHint.textContent = "Remove the image or choose another one";
  };

  reader.readAsDataURL(file);
});

function clearImage() {
  selectedImageData = null;
  imagePreview.hidden = true;
  previewImg.removeAttribute("src");
  uploadTitle.textContent = "Choose an image or drop it here";
  uploadHint.textContent = "PNG, JPG or WEBP · maximum 8 MB";
}

document.getElementById("removeImage").addEventListener("click", () => {
  referenceInput.value = "";
  clearImage();
});

function showError(message) {
  formMessage.textContent = message;
  formMessage.hidden = false;
}

function normalizeModel(value) {
  const model = String(value || "").toLowerCase();
  return model.includes("omni") ? "Omni Flash" : "Veo 3";
}

function normalizeRatio(value) {
  const ratio = String(value || "").toLowerCase();

  if (ratio.includes("9:16") || ratio.includes("portrait")) {
    return "9:16";
  }

  if (ratio.includes("1:1") || ratio.includes("square")) {
    return "1:1";
  }

  return "16:9";
}

function normalizeDuration(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : NaN;
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

  if (selectedImageData) {
    showError(
      "Reference-image uploading is not connected yet. Please remove the image and submit without it for now."
    );
    return;
  }

  const submitButton = form.querySelector('[type="submit"]');
  const originalButtonText = submitButton?.textContent;

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
  }

  try {
    const data = new FormData(form);

    const customerName = String(data.get("customerName") || "").trim();
    const email = String(data.get("email") || "").trim();
    const prompt = promptInput.value.trim();
    const duration = normalizeDuration(data.get("duration"));

    if (!customerName || !email || !prompt) {
      throw new Error("Please enter your name, email, and video prompt.");
    }

    if (prompt.length > 10000) {
      throw new Error("Your prompt is too long.");
    }

    if (![5, 8, 10, 15].includes(duration)) {
      throw new Error(
        "The selected duration must be 5, 8, 10, or 15 seconds."
      );
    }

    const request = {
      model: normalizeModel(data.get("model")),
      prompt,
      duration_seconds: duration,
      aspect_ratio: normalizeRatio(data.get("ratio")),
      visual_style: String(data.get("style") || ""),
      audio_preference: String(data.get("audio") || ""),
      intended_platform: String(data.get("useCase") || ""),
      customer_name: customerName,
      email,
      status: "pending",
      final_video_url: null
    };

    const response = await fetch(
      `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/video_requests`,
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
      console.error("Supabase error:", response.status, details);

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Supabase rejected the request. Please check your database permissions and security policy."
        );
      }

      if (response.status === 400 || response.status === 404) {
        throw new Error(
          "The request format or database columns may not match. Please share the browser error with me."
        );
      }

      throw new Error(
        "Your request could not be saved. Please try again."
      );
    }

    document.getElementById("successText").textContent =
      "Your video request was submitted successfully! Your request has been received and is pending review.";

    dialog.showModal();

    form.reset();
    clearImage();
    charCount.textContent = "0 / 2000";
  } catch (error) {
    showError(error.message || "Something went wrong. Please try again.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText || "Submit Request";
    }
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
