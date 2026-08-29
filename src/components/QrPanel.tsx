import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrPanel({
  value,
  size = 240,
  caption,
}: {
  value: string;
  size?: number;
  caption?: string;
}) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).then((url) => {
      if (active) setSrc(url);
    });
    return () => {
      active = false;
    };
  }, [value, size]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-2xl bg-white p-3" style={{ width: size + 24, height: size + 24 }}>
        {src ? (
          <img src={src} alt={caption ?? "QR code"} width={size} height={size} className="h-full w-full" />
        ) : null}
      </div>
      {caption ? <p className="text-center text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  );
}

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-panel p-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 truncate font-mono text-sm">{value}</code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded-lg border border-signal-line bg-signal-soft px-3 py-1.5 text-xs text-signal"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
