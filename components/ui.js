"use client";
import { useEffect, useId, useRef, useState } from "react";
import { X, Upload, Camera } from "lucide-react";
export function Field({ label, children }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {typeof children === "function" ? children(id) : children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  busy = false,
}) {
  const dialog = useRef(null),
    close = useRef(onClose),
    busyRef = useRef(busy);
  close.current = onClose;
  busyRef.current = busy;
  useEffect(() => {
    const previous = document.activeElement;
    const elements = () =>
      Array.from(
        dialog.current?.querySelectorAll(
          'button:not([disabled]),a[href],input:not([disabled]),select,textarea,[tabindex="0"]',
        ) || [],
      ).filter((el) => el.getClientRects().length);
    elements()[0]?.focus();
    const key = (e) => {
      if (e.key === "Escape" && !busyRef.current) close.current();
      if (e.key === "Tab") {
        const all = elements();
        if (!all.length) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && document.activeElement === all[0]) {
          e.preventDefault();
          all.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === all.at(-1)) {
          e.preventDefault();
          all[0].focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={dialog}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            disabled={busy}
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export async function api(path, method = "GET", body) {
  let response;
  try {
    response = await fetch("/api/" + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Could not connect to Toga. Check your connection and try again.",
    );
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 428) window.location.assign("/accept-terms");
  if (!response.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
async function preparePhoto(file) {
  if (file.size > 25 * 1024 * 1024)
    throw new Error("This photo is too large to process. Try another photo.");
  try {
    if (
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      /\.hei[cf]$/i.test(file.name)
    ) {
      const { heicTo } = await import("heic-to");
      file = await heicTo({ blob: file, type: "image/jpeg", quality: 0.88 });
    }
    const bitmap = await createImageBitmap(file);
    try {
      for (const [size, quality] of [[1800, 0.82], [1600, 0.74], [1400, 0.68]]) {
        const ratio = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
        canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("canvas unavailable");
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => {
          canvas.toBlob(resolve, "image/webp", quality);
        });
        if (blob && blob.size > 0 && blob.size <= 3.8 * 1024 * 1024)
          return new File([blob], "photo.webp", { type: "image/webp" });
      }
    } finally {
      bitmap.close?.();
    }
  } catch (error) {
    if (error.message === "This photo is too large to process. Try another photo.")
      throw error;
  }
  throw new Error("We couldn't process this photo. Try choosing another image.");
}
function upload(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.timeout = 120000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("Upload failed. Please try a smaller photo."));
        return;
      }
      xhr.status === 200
        ? resolve(data.url)
        : reject(new Error(data.error || "Upload failed. Please try again."));
    };
    xhr.onerror = () =>
      reject(
        new Error("Upload interrupted. Check your connection and try again."),
      );
    xhr.ontimeout = () =>
      reject(new Error("Upload took too long. Please try again."));
    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  });
}
export function PhotoUpload({
  value = [],
  onChange,
  max = 4,
  onBusyChange = () => {},
}) {
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [dragging, setDragging] = useState(false);
  const input = useRef(null),
    camera = useRef(null),
    lock = useRef(false);
  async function add(files) {
    if (lock.current) return;
    const selected = Array.from(files || []);
    if (!selected.length) return;
    const available = max - value.length;
    if (selected.length > available) {
      setError(
        `You can add ${available} more photo${available === 1 ? "" : "s"}.`,
      );
      return;
    }
    if (selected.some((file) => file.size > 25 * 1024 * 1024)) {
      setError("This photo is too large to process. Try another photo.");
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    const next = [...value];
    const failures = [];
    try {
      for (let i = 0; i < selected.length; i++) {
        setProgress(Math.round((i / selected.length) * 100));
        try {
          const photo = await preparePhoto(selected[i]);
          const url = await upload(photo, (p) =>
            setProgress(Math.round(((i + p / 100) / selected.length) * 100)),
          );
          next.push(url);
          onChange([...next]);
        } catch (error) {
          failures.push(`${selected[i].name || `Photo ${i + 1}`}: ${error.message}`);
        }
      }
      if (failures.length) setError(failures.join(" "));
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
      setProgress(0);
      if (input.current) input.current.value = "";
      if (camera.current) camera.current.value = "";
    }
  }
  return (
    <div className="photo-upload">
      <div className="photo-previews">
        {value.map((p, i) => (
          <div key={p}>
            <img src={p} alt={`Photo ${i + 1}`} />
            <button
              type="button"
              disabled={busy}
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => onChange(value.filter((_, j) => i !== j))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      {value.length < max && (
        <div
          className={`upload ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            add(e.dataTransfer.files);
          }}
        >
          <Upload size={22} />
          <span>
            Choose photos or drop them here
            <small>
              Up to {max} photo{max === 1 ? "" : "s"} · automatically resized
            </small>
          </span>
          <div className="upload-actions">
            <button
              type="button"
              className="button outline"
              disabled={busy}
              onClick={() => input.current.click()}
            >
              Choose photos
            </button>
            <button
              type="button"
              className="button outline"
              disabled={busy}
              onClick={() => camera.current.click()}
            >
              <Camera size={15} /> Camera
            </button>
          </div>
          <input
            ref={input}
            type="file"
            aria-label="Choose photos"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple={max > 1}
            onChange={(e) => add(e.target.files)}
            hidden
          />
          <input
            ref={camera}
            type="file"
            aria-label="Take a photo"
            accept="image/*"
            capture="environment"
            onChange={(e) => add(e.target.files)}
            hidden
          />
        </div>
      )}
      {busy && (
        <div className="upload-progress" role="status">
          <progress value={progress} max="100" />
          <span>
            {progress === 100
              ? "Processing photo…"
              : `Uploading · ${progress}%`}
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
export const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
