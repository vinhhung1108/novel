import { cn } from "./cn";
export function Alert({
  children,
  className,
  variant = "info",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "info" | "warning" | "error" | "success";
}) {
  const styles = {
    info: "bg-blue-50 text-blue-700 border-blue-200",
    warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
    error: "bg-red-50 text-red-700 border-red-200",
    success: "bg-green-50 text-green-700 border-green-200",
  } as const;
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        styles[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
