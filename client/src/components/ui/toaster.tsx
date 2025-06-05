// client/src/components/ui/toaster.tsx - with improved z-index and auto-dismiss timer display
import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useEffect, useState } from "react";

interface ToastTimerProps {
  duration: number;
  id: string;
  onComplete: () => void;
}

// This component shows a visual timer for how long the toast will stay visible
function ToastTimer({ duration, id, onComplete }: ToastTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (!duration) return;

    // Don't show timer for very long durations
    if (duration > 10000) return;

    setTimeLeft(duration);

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onComplete();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [duration, id, onComplete]);

  // Don't render timer for very long durations
  if (!duration || duration > 10000) return null;

  // Calculate progress as percentage
  const progress = (timeLeft / duration) * 100;

  return (
    <div className="w-full h-1 bg-gray-200 mt-1 overflow-hidden rounded-full">
      <div
        className="h-full bg-primary transition-all duration-100 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
        duration,
        ...props
      }) {
        return (
          <Toast key={id} {...props} className="z-[1100]">
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}

              {/* Add timer bar for toasts with duration */}
              {duration && (
                <ToastTimer
                  duration={duration}
                  id={id}
                  onComplete={() => dismiss(id)}
                />
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport className="fixed top-0 z-[1000] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]" />
    </ToastProvider>
  );
}
