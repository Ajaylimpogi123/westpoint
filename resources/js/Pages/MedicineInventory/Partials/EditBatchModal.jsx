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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InputError from "@/components/InputError";
import useEditBatch from "../Hooks/useEditBatch";
import { useState, useEffect } from "react";
import { toDisplayDate, toIsoDate } from "@/utils/dateFormat";
export default function EditBatchModal({ batch, medicine, children }) {
    const {
        open,
        openModal,
        closeModal,
        data,
        setData,
        errors,
        processing,
        handleSubmit,
        breakdown,
        delta,
        packSize,
    } = useEditBatch(batch, medicine);

    // ...inside the component, after useEditBatch():
    const [expiryDisplay, setExpiryDisplay] = useState(
        toDisplayDate(data.expiry),
    );

    useEffect(() => {
        setExpiryDisplay(toDisplayDate(data.expiry));
    }, [data.expiry]);

    function handleExpiryChange(e) {
        let val = e.target.value.replace(/[^\d]/g, ""); // digits only
        if (val.length > 2) val = val.slice(0, 2) + "-" + val.slice(2);
        if (val.length > 5) val = val.slice(0, 5) + "-" + val.slice(5, 9);
        setExpiryDisplay(val);

        const iso = toIsoDate(val);
        if (iso) setData("expiry", iso); // only updates when a full valid date is typed
    }
    return (
        <>
            <div onClick={openModal}>{children}</div>

            <Dialog open={open} onOpenChange={closeModal}>
                <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader className="pb-4">
                            <DialogTitle>Edit Batch</DialogTitle>
                            <DialogDescription>
                                Update lot details for batch{" "}
                                {batch?.lot_number || `#${batch?.id}`}. Stock is
                                entered in pieces
                                {packSize >= 1
                                    ? ` (${packSize} pcs/box)`
                                    : " (no pack size set)"}
                                .
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4">
                            <div className="grid gap-3">
                                <Label htmlFor="edit_quantity_in_pieces">
                                    Stock level (pieces)
                                </Label>
                                <Input
                                    id="edit_quantity_in_pieces"
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={data.quantity_in_pieces}
                                    onChange={(e) =>
                                        setData(
                                            "quantity_in_pieces",
                                            e.target.value,
                                        )
                                    }
                                />
                                <InputError
                                    message={errors.quantity_in_pieces}
                                />
                                <p className="text-sm text-muted-foreground">
                                    {breakdown}
                                    {delta !== 0 && (
                                        <span
                                            className={`ml-2 font-semibold ${
                                                delta > 0
                                                    ? "text-green-700"
                                                    : "text-destructive"
                                            }`}
                                        >
                                            {delta > 0 ? "+" : ""}
                                            {delta} vs. current
                                        </span>
                                    )}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-3">
                                    <Label htmlFor="edit_lot_number">
                                        Lot Number
                                    </Label>
                                    <Input
                                        id="edit_lot_number"
                                        value={data.lot_number}
                                        onChange={(e) =>
                                            setData(
                                                "lot_number",
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <InputError message={errors.lot_number} />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="edit_expiry">
                                        Expiry Date
                                    </Label>
                                    <Input
                                        id="edit_expiry"
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="mm-dd-yyyy"
                                        maxLength={10}
                                        value={expiryDisplay}
                                        onChange={handleExpiryChange}
                                    />
                                    <InputError message={errors.expiry} />
                                </div>
                            </div>

                            <div className="grid gap-3">
                                <Label htmlFor="edit_shelf_number">
                                    Shelf Number
                                </Label>
                                <Input
                                    id="edit_shelf_number"
                                    value={data.shelf_number}
                                    onChange={(e) =>
                                        setData("shelf_number", e.target.value)
                                    }
                                    placeholder="e.g. A-12"
                                />
                                <InputError message={errors.shelf_number} />
                            </div>

                            <div className="grid gap-3">
                                <Label htmlFor="edit_adjustment_reason">
                                    Reason for adjustment
                                </Label>
                                <Input
                                    id="edit_adjustment_reason"
                                    value={data.adjustment_reason}
                                    onChange={(e) =>
                                        setData(
                                            "adjustment_reason",
                                            e.target.value,
                                        )
                                    }
                                    placeholder="e.g. Physical count correction"
                                />
                                <InputError
                                    message={errors.adjustment_reason}
                                />
                            </div>
                        </div>

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
                                Save Batch
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
