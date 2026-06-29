import StepItemLot from "./StepItemLot";
import StepRouteReason from "./StepRouteReason";
import StepReview from "./StepReview";

const STEPS = ["Item & lot", "Route & reason", "Review & submit"];

/**
 * TransferWizard
 * Renders the 3-step bar + active step panel.
 * All props come from useStockTransferForm() + page-level props (products, branches).
 */
export default function TransferWizard({
    step,
    goNext,
    goBack,
    data,
    setData,
    errors,
    processing,
    selectedItems,
    addItem,
    removeItem,
    submit, // ← removeItem from hook
    products,
    branches,
    userBranchName,
}) {
    return (
        <div className="space-y-6">
            {/* Step bar */}
            <div className="flex items-center">
                {STEPS.map((label, idx) => {
                    const stepNum = idx + 1;
                    const isDone = stepNum < step;
                    const isActive = stepNum === step;

                    return (
                        <div
                            key={label}
                            className="flex items-center flex-1 last:flex-none"
                        >
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <div
                                    className={`w-7 h-7 rounded-full flex items-center justify-center
                                    text-xs font-semibold flex-shrink-0 transition-all
                                    ${
                                        isDone
                                            ? "bg-green-500 text-white"
                                            : isActive
                                              ? "bg-blue-600 text-white"
                                              : "border border-gray-300 text-gray-400"
                                    }`}
                                >
                                    {isDone ? "✓" : stepNum}
                                </div>
                                <span
                                    className={`text-xs font-medium whitespace-nowrap
                                    ${
                                        isDone
                                            ? "text-green-600"
                                            : isActive
                                              ? "text-blue-600"
                                              : "text-gray-400"
                                    }`}
                                >
                                    {label}
                                </span>
                            </div>
                            {idx < STEPS.length - 1 && (
                                <div
                                    className={`flex-1 h-px mx-3 ${isDone ? "bg-green-400" : "bg-gray-200"}`}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Step 1 */}
            {step === 1 && (
                <StepItemLot
                    products={products}
                    selectedItems={selectedItems}
                    onAddItem={addItem}
                    onRemoveItem={removeItem} // ← fix: was missing before
                    onNext={goNext}
                />
            )}

            {/* Step 2 */}
            {step === 2 && (
                <StepRouteReason
                    data={data}
                    setData={setData}
                    errors={errors}
                    branches={branches}
                    userBranchName={userBranchName}
                    onNext={goNext}
                    onBack={goBack}
                />
            )}

            {/* Step 3 */}
            {step === 3 && (
                <StepReview
                    data={data}
                    selectedItems={selectedItems}
                    branches={branches}
                    userBranchName={userBranchName}
                    processing={processing}
                    onSubmit={submit}
                    onBack={goBack}
                />
            )}
        </div>
    );
}
