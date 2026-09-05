import { useEffect, useState } from "react";
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
import useAddStock from "../Hooks/useAddStock";
import { isBoxUnit } from "@/lib/units";
import { toDisplayDate, toIsoDate } from "@/utils/dateFormat";

export default function AddStockModal({ medicine, children }) {
    const {
        UNIT_TYPES,
        open,
        openModal,
        closeModal,
        data,
        setData,
        errors,
        processing,
        handleSubmit,
        normalizeQuantity,
        piecesLabel,
        boxesUnavailable,
    } = useAddStock(medicine);

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
        if (iso) setData("expiry", iso); // only commits once a full valid date is typed
    }

    return (
        <>
            <div onClick={openModal}>{children}</div>

            <Dialog open={open} onOpenChange={closeModal}>
                <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader className="pb-4">
                            <DialogTitle>Add Stock</DialogTitle>
                            <DialogDescription>
                                Receive inventory for{" "}
                                <span className="font-medium">
                                    {medicine?.med_name}
                                </span>
                                . Stock is assigned to your branch automatically
                                and stored in pieces.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-3">
                                    <Label htmlFor="boxes_received">
                                        Quantity Received
                                    </Label>
                                    <Input
                                        id="boxes_received"
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={data.boxes_received}
                                        onChange={(e) =>
                                            setData(
                                                "boxes_received",
                                                e.target.value,
                                            )
                                        }
                                        onBlur={normalizeQuantity}
                                    />
                                    <InputError
                                        message={errors.boxes_received}
                                    />
                                </div>

                                <div className="grid gap-3">
                                    <Label htmlFor="add_stock_unit_type">
                                        Unit
                                    </Label>
                                    <select
                                        id="add_stock_unit_type"
                                        value={data.unit_type}
                                        onChange={(e) =>
                                            setData("unit_type", e.target.value)
                                        }
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        {UNIT_TYPES.map((unitType) => (
                                            <option
                                                key={unitType.value}
                                                value={unitType.value}
                                                disabled={
                                                    boxesUnavailable &&
                                                    isBoxUnit(unitType.value)
                                                }
                                            >
                                                {unitType.label}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError message={errors.unit_type} />
                                </div>
                            </div>

                            <p className="text-sm text-muted-foreground">
                                Adds{" "}
                                <span className="font-semibold text-foreground">
                                    {piecesLabel}
                                </span>
                            </p>

                            {boxesUnavailable && (
                                <p className="text-xs text-destructive">
                                    No pack size set for this medicine — add
                                    stock by the piece, or set a pack size
                                    first.
                                </p>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-3">
                                    <Label htmlFor="lot_number">
                                        Lot Number
                                    </Label>
                                    <Input
                                        id="lot_number"
                                        value={data.lot_number}
                                        onChange={(e) =>
                                            setData(
                                                "lot_number",
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Optional"
                                    />
                                    <InputError message={errors.lot_number} />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="expiry">Expiry Date</Label>
                                    <Input
                                        id="expiry"
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
                                <Label htmlFor="shelf_number">
                                    Shelf Number
                                </Label>
                                <Input
                                    id="shelf_number"
                                    value={data.shelf_number}
                                    onChange={(e) =>
                                        setData("shelf_number", e.target.value)
                                    }
                                    placeholder="e.g. A-12"
                                />
                                <InputError message={errors.shelf_number} />
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
                                Add Stock
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
