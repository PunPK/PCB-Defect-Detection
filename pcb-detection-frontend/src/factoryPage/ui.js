// Shared UI kit for the factory (MES-style) pages.
// All components support light + dark theme via Tailwind `dark:` variants.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  XCircle,
  ImageOff,
} from "lucide-react";

export const cx = (...c) => c.filter(Boolean).join(" ");

export const API_BASE = `http://${window.location.hostname}:8000`;

/* ---------------------------------- Button --------------------------------- */

const BUTTON_VARIANTS = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 border-transparent dark:bg-brand-600 dark:hover:bg-brand-500 shadow-sm",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 border-transparent dark:hover:bg-emerald-500 shadow-sm",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 border-transparent dark:hover:bg-rose-500 shadow-sm",
  secondary:
    "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 active:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 shadow-sm",
  "danger-outline":
    "bg-white text-rose-600 border-rose-300 hover:bg-rose-50 dark:bg-transparent dark:text-rose-400 dark:border-rose-500/40 dark:hover:bg-rose-500/10 shadow-sm",
  outline:
    "bg-transparent text-brand-600 border-brand-300 hover:bg-brand-50 dark:text-brand-400 dark:border-brand-500/40 dark:hover:bg-brand-500/10 shadow-sm",
  ghost:
    "bg-transparent text-slate-600 border-transparent hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
};

const BUTTON_SIZES = {
  sm: "h-9 px-3 text-xs gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
  icon: "h-10 w-10 justify-center",
};

export function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  className = "",
  children,
  type = "button",
  disabled,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center rounded-md border font-semibold transition-colors select-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary,
        BUTTON_SIZES[size] || BUTTON_SIZES.md,
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      ) : (
        Icon && <Icon className="h-4 w-4 shrink-0" />
      )}
      {children && <span className="truncate">{children}</span>}
    </button>
  );
}

/* ----------------------------------- Panel --------------------------------- */

export function Panel({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className = "",
  bodyClassName = "p-4",
}) {
  return (
    <section
      className={cx(
        "rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className
      )}
    >
      {(title || Icon || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 rounded-t-lg dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="truncate text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/* -------------------------------- Page header ------------------------------ */

export function PageHeader({ code, title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between dark:border-slate-800">
      <div className="min-w-0">
        {code && (
          <div className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">
            {code}
          </div>
        )}
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end print:hidden">
          {actions}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Stat tile ------------------------------- */

const TONES = {
  neutral: "text-slate-900 dark:text-white",
  brand: "text-brand-600 dark:text-brand-400",
  pass: "text-emerald-600 dark:text-emerald-400",
  warn: "text-warn-600 dark:text-warn-400",
  fail: "text-rose-600 dark:text-rose-400",
};

export function StatTile({ label, value, unit, icon: Icon, tone = "neutral", hint }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />}
      </div>
      <div
        className={cx(
          "mt-2 font-mono text-2xl font-bold tabular-nums sm:text-3xl",
          TONES[tone] || TONES.neutral
        )}
      >
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-slate-400">{unit}</span>}
      </div>
      {hint && (
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>
      )}
    </div>
  );
}

/* ------------------------------- Verdict badge ----------------------------- */

export function getVerdict(accuracy, description = "") {
  const desc = (description || "").toUpperCase();
  if (desc.includes("PASS") || accuracy >= 80) return "PASS";
  if (desc.includes("WARN") || accuracy >= 70) return "WARN";
  return "FAIL";
}

const VERDICT_STYLE = {
  PASS: {
    cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
    icon: CheckCircle2,
  },
  WARN: {
    cls: "bg-warn-50 text-warn-700 ring-warn-600/30 dark:bg-warn-500/10 dark:text-warn-400 dark:ring-warn-500/30",
    icon: AlertTriangle,
  },
  FAIL: {
    cls: "bg-rose-50 text-rose-700 ring-rose-600/30 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/30",
    icon: XCircle,
  },
};

export function VerdictBadge({ verdict, label, size = "sm" }) {
  const key = (verdict || "").toUpperCase();
  const v = VERDICT_STYLE[key] || VERDICT_STYLE.FAIL;
  const Icon = v.icon;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded font-bold uppercase tracking-wide ring-1 ring-inset",
        size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-[11px]",
        v.cls
      )}
    >
      <Icon className={size === "lg" ? "h-4 w-4" : "h-3 w-3"} />
      {label || verdict}
    </span>
  );
}

/* --------------------------------- Status dot ------------------------------ */

export function StatusIndicator({ state = "idle", label }) {
  const map = {
    idle: "bg-slate-400",
    connecting: "bg-warn-500 animate-pulse",
    online: "bg-emerald-500",
    error: "bg-rose-500",
  };
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
      <span className="relative flex h-2.5 w-2.5">
        {state === "online" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span
          className={cx("relative inline-flex h-2.5 w-2.5 rounded-full", map[state] || map.idle)}
        />
      </span>
      {label}
    </span>
  );
}

/* ------------------------------ Loading / empty ---------------------------- */

export function LoadingScreen({ label = "กำลังโหลดข้อมูล..." }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
      <Loader2 className="h-10 w-10 animate-spin text-brand-600 dark:text-brand-400" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon = ImageOff, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Icon className="h-6 w-6" />
      </span>
      <p className="font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ----------------------------------- Modal --------------------------------- */

export function useEscape(active, onEscape) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => e.key === "Escape" && onEscape?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onEscape]);
}

export function ImagePreviewModal({ image, title, onClose }) {
  useEscape(!!image, onClose);

  useEffect(() => {
    if (!image) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [image]);

  if (!image) return null;

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h4 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h4>
          <Button
            variant="ghost"
            size="icon"
            icon={X}
            onClick={onClose}
            aria-label="ปิด"
          />
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-100 p-3 dark:bg-slate-950">
          <img
            src={image}
            alt={title}
            className="max-h-[78vh] max-w-full object-contain"
          />
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "ลบข้อมูล",
  onConfirm,
  onClose,
}) {
  useEscape(open, onClose);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="alertdialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-4 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{message}</p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 rounded-b-lg sm:flex-row sm:justify-end dark:border-slate-800 dark:bg-slate-900/60">
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm?.();
              onClose?.();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
}

/* ------------------------------ Image frame -------------------------------- */

export function ImageFrame({
  src,
  alt,
  onClick,
  className = "h-56",
  emptyLabel = "ไม่มีข้อมูลรูปภาพ",
}) {
  // A div (not <button>) so images still render when printing — exportPdf.css hides buttons in print.
  return (
    <div
      role={src && onClick ? "button" : undefined}
      tabIndex={src && onClick ? 0 : undefined}
      onClick={src ? onClick : undefined}
      onKeyDown={(e) => src && onClick && (e.key === "Enter" || e.key === " ") && onClick()}
      className={cx(
        "group relative flex w-full items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950",
        src ? "cursor-zoom-in" : "cursor-default",
        className
      )}
    >
      {src ? (
        <>
          <img src={src} alt={alt} className="h-full w-full object-contain" />
          <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-slate-900/75 px-2 py-0.5 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            ขยายรูปภาพ
          </span>
        </>
      ) : (
        <span className="flex flex-col items-center gap-1 text-xs text-slate-400">
          <ImageOff className="h-5 w-5" />
          {emptyLabel}
        </span>
      )}
    </div>
  );
}

export const b64 = (data) => (data ? `data:image/jpeg;base64,${data}` : null);
