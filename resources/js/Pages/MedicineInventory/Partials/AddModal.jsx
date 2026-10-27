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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import InputError from "@/components/InputError";
import useAddMedicine from "../Hooks/useAddMedicine";
import { MEDICINE_FORMS } from "../lib/medicineForms";

export default function AddModal({
    children,
    branchId = null,
    branchName = null,
    branches = [],
    canAssignBranch = false,
    preferredBranchId = null,
}) {
    const {
        open,
        openModal,
        closeModal,
        data,
        setData,
        errors,
        processing,
        handleSubmit,
        canAssignBranch: canChangeBranch,
        branches: branchOptions,
        suggestions,
        showSuggestions,
        hideSuggestions,
        handleNameChange,
        pickSuggestion,
        existingMatch,
        existingBranchIds,
        toggleBranch,
        selectAllBranches,
        needsNameConfirmation,
        similarMedicines,
        confirmNewName,
    } = useAddMedicine({
        branchId,
        canAssignBranch,
        branches,
        preferredBranchId,
    });

    return (
        <>
            <div onClick={openModal}>{children}</div>

            <Dialog open={open} onOpenChange={closeModal}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader className="pb-4">
                            <DialogTitle>Add Medicine</DialogTitle>
                            <DialogDescription>
                                Register a new medicine product. Retail price is
                                per piece; wholesale price is per box. Start
                                typing the name to reuse an existing medicine.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4">
                            <div className="grid gap-3">
                                <div className="flex items-center justify-between">
                                    <Label>
                                        {canChangeBranch ? "Branches" : "Branch"}
                                    </Label>
                                    {canChangeBranch &&
                                        branchOptions.length > 1 && (
                                            <button
                                                type="button"
                                                className="text-xs font-medium text-primary hover:underline"
                                                onClick={selectAllBranches}
                                            >
                                                Select all
                                            </button>
                                        )}
                                </div>
                                {canChangeBranch ? (
                                    <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                                        {branchOptions.map((branch) => {
                                            const id = String(branch.id);
                                            const alreadyHasIt =
                                                existingBranchIds.has(id);

                                            return (
                                                <div
                                                    key={branch.id}
                                                    className="flex items-center gap-2"
                                                >
                                                    <Checkbox
                                                        id={`add_medicine_branch_${id}`}
                                                        checked={data.branch_ids.includes(
                                                            id,
                                                        )}
                                                        disabled={alreadyHasIt}
                                                        onCheckedChange={(
                                                            checked,
                                                        ) =>
                                                            toggleBranch(
                                                                id,
                                                                checked === true,
                                                            )
                                                        }
                                                    />
                                                    <Label
                                                        htmlFor={`add_medicine_branch_${id}`}
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
                                ) : (
                                    <Input
                                        value={
                                            branchName ?? "No branch assigned"
                                        }
                                        readOnly
                                        className="bg-muted"
                                    />
                                )}
                                <InputError
                                    message={
                                        errors.branch_ids ??
                                        Object.entries(errors).find(([key]) =>
                                            key.startsWith("branch_ids."),
                                        )?.[1]
                                    }
                                />
                            </div>

                            <div className="grid gap-3">
                                <Label htmlFor="med_name">Medicine Name</Label>
                                <Input
                                    id="med_name"
                                    value={data.med_name}
                                    onChange={(e) =>
                                        handleNameChange(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Escape" && showSuggestions) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            hideSuggestions();
                                        }
                                    }}
                                    placeholder="e.g. Paracetamol"
                                    autoComplete="off"
                                />
                                {showSuggestions && (
                                    <div className="overflow-hidden rounded-md border">
                                        <p className="border-b bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                                            Existing medicines — pick one to
                                            reuse its exact details
                                        </p>
                                        <ul className="max-h-48 overflow-y-auto">
                                            {suggestions.map((medicine) => (
                                                <li
                                                    key={`${medicine.label}-${medicine.branches
                                                        .map((b) => b.id)
                                                        .join(",")}`}
                                                >
                                                    <button
                                                        type="button"
                                                        className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
                                                        onClick={() =>
                                                            pickSuggestion(
                                                                medicine,
                                                            )
                                                        }
                                                    >
                                                        <span className="font-medium">
                                                            {medicine.label}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            Pack of{" "}
                                                            {medicine.pack_size}{" "}
                                                            · In:{" "}
                                                            {medicine.branches
                                                                .map(
                                                                    (b) =>
                                                                        b.branch_name,
                                                                )
                                                                .join(", ")}
                                                        </span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {existingMatch && (
                                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                        {existingMatch.label} already exists in{" "}
                                        {existingMatch.branches
                                            .map((b) => b.branch_name)
                                            .join(", ")}
                                        .{" "}
                                        {canChangeBranch
                                            ? "Those branches are skipped; tick the branches that still need it."
                                            : existingBranchIds.has(
                                                    String(branchId),
                                                )
                                              ? "Your branch already has it — add stock to the existing medicine instead."
                                              : "Its details have been filled in for your branch."}
                                    </p>
                                )}
                                <InputError message={errors.med_name} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-3">
                                    <Label htmlFor="dose">Dose</Label>
                                    <Input
                                        id="dose"
                                        value={data.dose}
                                        onChange={(e) =>
                                            setData("dose", e.target.value)
                                        }
                                        placeholder="e.g. 500mg"
                                    />
                                    <InputError message={errors.dose} />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="form">Form</Label>
                                    <Select
                                        value={data.form}
                                        onValueChange={(value) =>
                                            setData("form", value)
                                        }
                                    >
                                        <SelectTrigger id="form">
                                            <SelectValue placeholder="Select form" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MEDICINE_FORMS.map((form) => (
                                                <SelectItem
                                                    key={form}
                                                    value={form}
                                                >
                                                    {form}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={errors.form} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-3">
                                    <Label htmlFor="pack_size">Pack Size</Label>
                                    <Input
                                        id="pack_size"
                                        type="number"
                                        min="1"
                                        value={data.pack_size}
                                        onChange={(e) =>
                                            setData("pack_size", e.target.value)
                                        }
                                        placeholder="Pieces per box"
                                    />
                                    <InputError message={errors.pack_size} />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="brand_name">Brand</Label>
                                    <Input
                                        id="brand_name"
                                        value={data.brand_name}
                                        onChange={(e) =>
                                            setData(
                                                "brand_name",
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Brand name"
                                    />
                                    <InputError message={errors.brand_name} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-3">
                                    <Label htmlFor="retail_price">
                                        Retail Price (per piece)
                                    </Label>
                                    <Input
                                        id="retail_price"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={data.retail_price}
                                        onChange={(e) =>
                                            setData(
                                                "retail_price",
                                                e.target.value,
                                            )
                                        }
                                        placeholder="0.00"
                                    />
                                    <InputError message={errors.retail_price} />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="wholesale_price">
                                        Wholesale Price (per box)
                                    </Label>
                                    <Input
                                        id="wholesale_price"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={data.wholesale_price}
                                        onChange={(e) =>
                                            setData(
                                                "wholesale_price",
                                                e.target.value,
                                            )
                                        }
                                        placeholder="0.00"
                                    />
                                    <InputError
                                        message={errors.wholesale_price}
                                    />
                                </div>

                                <div className="grid gap-3">
                                    <Label htmlFor="vat_status">
                                        VAT Status
                                    </Label>
                                    <Select
                                        value={data.vat_status}
                                        onValueChange={(value) =>
                                            setData("vat_status", value)
                                        }
                                    >
                                        <SelectTrigger id="vat_status">
                                            <SelectValue placeholder="Select VAT status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Non-VAT">
                                                Non-VAT
                                            </SelectItem>
                                            <SelectItem value="VAT">
                                                VAT (+12%)
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <InputError message={errors.vat_status} />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="is_generic"
                                    checked={data.is_generic}
                                    onCheckedChange={(checked) =>
                                        setData("is_generic", checked === true)
                                    }
                                />
                                <Label
                                    htmlFor="is_generic"
                                    className="cursor-pointer font-normal"
                                >
                                    Generic medicine
                                </Label>
                                <InputError message={errors.is_generic} />
                            </div>

                            <div className="grid gap-3">
                                <Label htmlFor="stock_threshold">
                                    Stock Threshold
                                </Label>
                                <Input
                                    id="stock_threshold"
                                    type="number"
                                    min="0"
                                    value={data.stock_threshold}
                                    onChange={(e) =>
                                        setData(
                                            "stock_threshold",
                                            e.target.value,
                                        )
                                    }
                                    placeholder="e.g. 10"
                                />
                                <InputError message={errors.stock_threshold} />
                            </div>
                        </div>

                        {needsNameConfirmation && (
                            <div className="mt-4 space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                                <p className="font-medium">
                                    Is this the same as an existing medicine?
                                </p>
                                {similarMedicines.length > 0 ? (
                                    <ul className="space-y-2">
                                        {similarMedicines.map((medicine) => (
                                            <li
                                                key={`${medicine.label}-${medicine.branches
                                                    .map((b) => b.id)
                                                    .join(",")}`}
                                                className="flex items-center justify-between gap-3 rounded border border-amber-200 bg-white px-3 py-2"
                                            >
                                                <span>
                                                    <span className="font-medium">
                                                        {medicine.label}
                                                    </span>
                                                    <span className="block text-xs text-muted-foreground">
                                                        In:{" "}
                                                        {medicine.branches
                                                            .map(
                                                                (b) =>
                                                                    b.branch_name,
                                                            )
                                                            .join(", ")}
                                                    </span>
                                                </span>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        pickSuggestion(medicine)
                                                    }
                                                >
                                                    Use this
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>{errors.confirm_new_name}</p>
                                )}
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={processing}
                                    onClick={confirmNewName}
                                    className="h-auto whitespace-normal text-left"
                                >
                                    No, “{data.med_name.trim()}” is a different
                                    medicine — save it
                                </Button>
                            </div>
                        )}

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

                            <Button type="submit" disabled={processing}>
                                Add Medicine
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
