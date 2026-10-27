import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogClose,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import InputError from "@/components/InputError";
import useCopyMedicine from "../Hooks/useCopyMedicine";

export default function CopyToBranchModal({ medicine, branches = [], children }) {
    const {
        open,
        openModal,
        closeModal,
        data,
        errors,
        processing,
        handleSubmit,
        existingBranchIds,
        loadingPresence,
        toggleBranch,
    } = useCopyMedicine(medicine);

    const availableCount = branches.filter(
        (branch) => !existingBranchIds.has(String(branch.id)),
    ).length;

    return (
        <>
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    openModal();
                }}
            >
                {children}
            </div>

            <Dialog open={open} onOpenChange={closeModal}>
                <DialogContent className="sm:max-w-[440px]">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader className="pb-4">
                            <DialogTitle>Add to Branch</DialogTitle>
                            <DialogDescription>
                                Copy{" "}
                                <span className="font-medium text-foreground">
                                    {[
                                        medicine.med_name,
                                        medicine.dose,
                                        medicine.form,
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                    {medicine.brand_name
                                        ? ` (${medicine.brand_name})`
                                        : ""}
                                </span>{" "}
                                with the same name, pack size and prices. Stock
                                is not copied.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-2 rounded-md border p-3">
                            {branches.map((branch) => {
                                const id = String(branch.id);
                                const alreadyHasIt = existingBranchIds.has(id);

                                return (
                                    <div
                                        key={branch.id}
                                        className="flex items-center gap-2"
                                    >
                                        <Checkbox
                                            id={`copy_medicine_${medicine.id}_branch_${id}`}
                                            checked={data.branch_ids.includes(
                                                id,
                                            )}
                                            disabled={
                                                alreadyHasIt || loadingPresence
                                            }
                                            onCheckedChange={(checked) =>
                                                toggleBranch(
                                                    id,
                                                    checked === true,
                                                )
                                            }
                                        />
                                        <Label
                                            htmlFor={`copy_medicine_${medicine.id}_branch_${id}`}
                                            className={
                                                alreadyHasIt
                                                    ? "font-normal text-muted-foreground"
                                                    : "cursor-pointer font-normal"
                                            }
                                        >
                                            {branch.branch_name}
                                            {alreadyHasIt &&
                                                " (already has it)"}
                                        </Label>
                                    </div>
                                );
                            })}
                        </div>
                        {!loadingPresence && availableCount === 0 && (
                            <p className="mt-2 text-sm text-muted-foreground">
                                Every branch already carries this medicine.
                            </p>
                        )}
                        <InputError
                            className="mt-2"
                            message={
                                errors.branch_ids ??
                                Object.entries(errors).find(([key]) =>
                                    key.startsWith("branch_ids."),
                                )?.[1]
                            }
                        />

                        <DialogFooter className="mt-4">
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={processing}
                                    onClick={closeModal}
                                >
                                    Cancel
                                </Button>
                            </DialogClose>

                            <Button
                                type="submit"
                                disabled={
                                    processing || data.branch_ids.length === 0
                                }
                            >
                                Add to Branch
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
