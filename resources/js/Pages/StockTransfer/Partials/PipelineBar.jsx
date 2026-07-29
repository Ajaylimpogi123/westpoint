import { getPipelineStep } from "../lib/TransferHelpers";

const STEPS = ["Requested", "Admin review", "Stock moved", "Slip ready"];

/**
 * PipelineBar
 * Shows a 4-dot progress bar matching the status of the transfer.
 * Props: status, rejectedLabel (optional override for step 2 on rejected)
 */
export default function PipelineBar({ status }) {
    const doneUntil = getPipelineStep(status);
    const isRejected = status === "rejected" || status === "cancelled";

    return (
        <div className="flex items-center gap-0 bg-gray-50 rounded-lg px-3 py-2 mt-3">
            {STEPS.map((label, i) => {
                const stepNum = i + 1;
                const isDone = stepNum <= doneUntil;
                const isFailed = isRejected && stepNum === 2;
                const isActive = !isRejected && stepNum === doneUntil;

                const dotColor = isFailed
                    ? "bg-red-500"
                    : isDone
                      ? "bg-green-500"
                      : "bg-gray-300 border border-gray-300";

                const lineColor =
                    isDone && stepNum < doneUntil
                        ? isRejected && stepNum >= 2
                            ? "bg-red-200"
                            : "bg-green-400"
                        : "bg-gray-200";

                return (
                    <div
                        key={label}
                        className="flex items-center flex-1 last:flex-none gap-0"
                    >
                        <div className="flex flex-col items-center gap-1">
                            <span
                                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`}
                            />
                            <span
                                className={`text-[10px] whitespace-nowrap ${
                                    isFailed
                                        ? "text-red-600"
                                        : isDone
                                          ? "text-green-600"
                                          : "text-gray-400"
                                }`}
                            >
                                {label}
                            </span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div
                                className={`flex-1 h-px mx-1 mb-3 ${lineColor}`}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
