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
import InputError from "@/Components/InputError";
import useEditBatch from "../Hooks/useEditBatch";

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
        piecesPreview,
    } = useEditBatch(batch, medicine);

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
                                {batch?.lot_number || `#${batch?.id}`}. Quantity
                                is stored in pieces (
                                {medicine?.pack_size ?? 1} pcs/box).
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4">
                            <div className="grid gap-3">
                                <Label htmlFor="edit_boxes_received">
                                    Boxes (stock level)
                                </Label>
                                <Input
                                    id="edit_boxes_received"
                                    type="number"
                                    min="0"
                                    value={data.boxes_received}
                                    onChange={(e) =>
                                        setData(
                                            "boxes_received",
                                            e.target.value,
                                        )
                                    }
                                />
                                <InputError message={errors.boxes_received} />
                                <p className="text-sm text-muted-foreground">
                                    Total pieces:{" "}
                                    <span className="font-semibold text-foreground">
                                        {piecesPreview}
                                    </span>
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
                                        type="date"
                                        value={data.expiry}
                                        onChange={(e) =>
                                            setData("expiry", e.target.value)
                                        }
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
                                        setData(
                                            "shelf_number",
                                            e.target.value,
                                        )
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
                                Save Batch
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
