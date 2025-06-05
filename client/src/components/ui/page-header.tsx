import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  heading: string;
  subheading?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  heading,
  subheading,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col space-y-2 pb-6", className)}>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {subheading && (
        <p className="text-muted-foreground">{subheading}</p>
      )}
    </div>
  );
}