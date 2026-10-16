import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground",
  secondary: "bg-surface-2 text-foreground",
  danger: "bg-surface-2 text-danger",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`h-12 w-full rounded-xl px-4 text-base font-semibold transition active:scale-[0.98] disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

const FIELD_CLASS =
  "h-12 w-full rounded-xl border border-border bg-surface px-4 text-base text-foreground outline-none placeholder:text-muted focus:border-accent";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_CLASS} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${FIELD_CLASS} ${className}`} {...props} />;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-2xl bg-surface p-4 ${className}`}>{children}</section>;
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="mb-5 text-2xl font-bold">{children}</h1>;
}
