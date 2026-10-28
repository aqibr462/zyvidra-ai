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
let lastRequest = null;

document.getElementById("year").textContent = new Date().getFullYear();
promptInput.addEventListener("input", () => charCount.textContent = `${promptInput.value.length} / 2000`);

referenceInput.addEventListener("change", () => {
  const file = referenceInput.files && referenceInput.files[0];
  formMessage.hidden = true;
  if (!file) return clearImage();
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    showError("Please select a JPG, PNG, or WEBP image."); referenceInput.value = ""; return clearImage();
  }
  if (file.size > 8 * 1024 * 1024) {
    showError("This demo accepts images up to 8 MB. Please choose a smaller file."); referenceInput.value = ""; return clearImage();
  }
  const reader = new FileReader();
  reader.onload = () => {
    selectedImageData = reader.result;
    previewImg.src = selectedImageData;
    fileName.textContent = file.name;
    fileSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    imagePreview.hidden = false;
    uploadTitle.textContent = "Reference image selected";
    uploadHint.textContent = "You can remove it or choose another image";
  };
  reader.readAsDataURL(file);
});
function clearImage() {
  selectedImageData = null; imagePreview.hidden = true; previewImg.removeAttribute("src");
  uploadTitle.textContent = "Choose an image or drop it here";
  uploadHint.textContent = "PNG, JPG or WEBP · maximum 8 MB in this demo";
}
document.getElementById("removeImage").addEventListener("click", () => { referenceInput.value = ""; clearImage(); });
function showError(message) { formMessage.textContent = message; formMessage.hidden = false; }
form.addEventListener("submit", (event) => {
  event.preventDefault(); formMessage.hidden = true;
  const data = new FormData(form);
  lastRequest = {
    demo: true,
    orderId: "ZYV-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    createdAt: new Date().toISOString(),
    model: data.get("model"),
    prompt: promptInput.value.trim(),
    aspectRatio: data.get("ratio"),
    preferredDuration: data.get("duration"),
    visualStyle: data.get("style"),
    audioPreference: data.get("audio"),
    useCase: data.get("useCase"),
    customerName: data.get("customerName").trim(),
    email: data.get("email").trim(),
    referenceImage: selectedImageData ? { fileName: referenceInput.files[0]?.name || "reference-image", dataUrl: selectedImageData } : null,
    status: "Demo only — not sent to an admin"
  };
  document.getElementById("successText").textContent = `Demo request ${lastRequest.orderId} · ${lastRequest.model} · ${lastRequest.preferredDuration}. Your request preview is ready to export. No information has been sent to a server.`;
  dialog.showModal();
});
document.getElementById("downloadJson").addEventListener("click", () => {
  if (!lastRequest) return;
  const blob = new Blob([JSON.stringify(lastRequest, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = `${lastRequest.orderId.toLowerCase()}-request.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});
document.getElementById("closeDialog").addEventListener("click", () => dialog.close());
const zone = document.querySelector(".upload-zone");
zone.addEventListener("dragover", e => { e.preventDefault(); zone.style.borderColor = "#a78bfa"; });
zone.addEventListener("dragleave", () => zone.style.borderColor = "");
zone.addEventListener("drop", e => {
  e.preventDefault(); zone.style.borderColor = "";
  const file = e.dataTransfer.files && e.dataTransfer.files[0]; if (!file) return;
  const transfer = new DataTransfer(); transfer.items.add(file); referenceInput.files = transfer.files;
  referenceInput.dispatchEvent(new Event("change"));
});
