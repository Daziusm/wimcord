import { AlertTriangle, CheckCircle2, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { CompletionInfo } from "@/lib/completionMessage";
import { cn } from "@/lib/utils";

export function CompletionBanner({
    completion,
    onDismiss,
    onViewLogs,
}: {
    completion: CompletionInfo;
    onDismiss: () => void;
    onViewLogs?: () => void;
}) {
    const success = completion.variant === "success";
    const Icon = success ? CheckCircle2 : AlertTriangle;

    return (
        <Alert
            className={cn(
                "mx-4 mt-3 shrink-0 border",
                success
                    ? "border-emerald-600/40 bg-emerald-950/40 text-emerald-50"
                    : "border-destructive/50 bg-destructive/10"
            )}
        >
            <Icon className={cn("h-5 w-5", success ? "text-emerald-400" : "text-destructive")} />
            <div className="flex flex-1 items-start justify-between gap-3">
                <div>
                    <AlertTitle className={cn("text-base", success && "text-emerald-100")}>
                        {completion.title}
                    </AlertTitle>
                    <AlertDescription className={cn("mt-1", success && "text-emerald-200/90")}>
                        {completion.description}
                    </AlertDescription>
                </div>
                <div className="flex shrink-0 gap-1">
                    {onViewLogs ? (
                        <Button
                            type="button"
                            variant={success ? "ghost" : "outline"}
                            size="sm"
                            className="h-7"
                            onClick={onViewLogs}
                        >
                            View logs
                        </Button>
                    ) : null}
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onDismiss}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </Alert>
    );
}
