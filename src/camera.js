// ---------------------------------------------------------------------------
// Live camera + video recording in the browser (getUserMedia + MediaRecorder).
// Needs a secure page: https, or localhost during development.
// ---------------------------------------------------------------------------
export const MAX_CLIP_MS = 30_000;

// MP4/H.264 first: Chrome (126+) and Safari write its duration, so the player's seek bar
// works. Chrome's WebM has no duration (Infinity) — it's only the fallback, e.g. Firefox.
const RECORDER_TYPES = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp8", "video/webm"];

// null when recording works here, otherwise the text key (locales/en.js) for why it can't.
export function recordingSupport() {
  if (!window.isSecureContext) {
    return "camera.insecure";
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    return "camera.unsupported";
  }
  return null;
}

// Rear camera where there is one; laptops fall back to their only webcam.
export function openCamera(facing) {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
}

export async function hasMultipleCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "videoinput").length > 1;
}

export function pickRecorderType() {
  return RECORDER_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function cameraErrorKey(err) {
  switch (err?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "camera.blocked";
    case "NotFoundError":
    case "OverconstrainedError":
      return "camera.notFound";
    case "NotReadableError":
    case "AbortError":
      return "camera.busy";
    default:
      return "camera.failed";
  }
}

// Still frame from a playing <video>, used as the clip's thumbnail.
export function captureFrame(video) {
  if (!video?.videoWidth) return null;
  const scale = Math.min(1, 640 / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function formatClipTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
