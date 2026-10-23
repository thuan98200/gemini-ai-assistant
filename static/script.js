
const $ = id => document.getElementById(id);

let lastAnswer = "";
let lastPrompt = "";
let hadImage = false;
let previewUrl = null;

$("temperature").addEventListener("input", () => {
  $("tempValue").textContent = $("temperature").value;
});

$("topP").addEventListener("input", () => {
  $("topPValue").textContent = $("topP").value;
});

$("image").addEventListener("change", () => {
  $("preview").replaceChildren();

  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;

  const file = $("image").files[0];
  if (!file) return;

  const allowed = ["image/png", "image/jpeg", "image/webp"];

  if (!allowed.includes(file.type)) {
    $("image").value = "";
    $("status").textContent = "Chỉ hỗ trợ PNG, JPEG và WebP.";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    $("image").value = "";
    $("status").textContent = "Ảnh không được vượt quá 5 MB.";
    return;
  }

  previewUrl = URL.createObjectURL(file);

  const img = document.createElement("img");
  img.src = previewUrl;
  img.alt = "Ảnh xem trước";

  $("preview").appendChild(img);
  $("status").textContent = "";
});

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(
      new Error("Không thể đọc tệp ảnh.")
    );

    reader.readAsDataURL(file);
  });
}

$("sendBtn").addEventListener("click", async () => {
  const prompt = $("prompt").value.trim();
  const file = $("image").files[0];

  if (!prompt) {
    $("status").textContent = "Bạn hãy nhập câu hỏi trước nhé.";
    $("prompt").focus();
    return;
  }

  $("sendBtn").disabled = true;
  $("exportBtn").disabled = true;
  $("status").textContent = "Đang kết nối Gemini...";
  $("answer").textContent = "Đang xử lý yêu cầu...";

  try {
    const image = file ? await readImage(file) : null;

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        image,
        temperature: Number($("temperature").value),
        top_p: Number($("topP").value)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Yêu cầu thất bại.");
    }

    lastAnswer = data.answer;
    lastPrompt = prompt;
    hadImage = Boolean(file);

    $("answer").textContent = lastAnswer;
    $("status").textContent = "Hoàn thành!";
    $("exportBtn").disabled = false;

  } catch (error) {
    $("answer").textContent = "";
    $("status").textContent =
      error.message || "Đã xảy ra lỗi kết nối.";
  } finally {
    $("sendBtn").disabled = false;
  }
});

$("exportBtn").addEventListener("click", () => {
  if (!lastAnswer) return;

  const report = [
    "BÁO CÁO GEMINI AI",
    "=================",
    "Loại yêu cầu: " +
      (hadImage ? "Phân tích hình ảnh" : "Hỏi đáp văn bản"),
    "",
    "CÂU HỎI:",
    lastPrompt,
    "",
    "KẾT QUẢ:",
    lastAnswer
  ].join("\n");

  const blob = new Blob(
    ["\uFEFF" + report],
    { type: "text/plain;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "bao-cao-gemini.txt";
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
