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
import useAddStock from "../Hooks/useAddStock";

export default function AddStockModal({
    medicine,
    branches,
    userBranchId,
    children,
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
        piecesPreview,
    } = useAddStock(medicine, branches, userBranchId);

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
                                . Enter quantity in boxes — the system converts
                                to individual pieces using pack size (
                                {medicine?.pack_size ?? 1} pcs/box).
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4">
                            <div className="grid gap-3">
                                <Label htmlFor="boxes_received">
                                    Boxes Received
                                </Label>
                                <Input
                                    id="boxes_received"
                                    type="number"
                                    min="1"
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
                                    Total pieces to save:{" "}
                                    <span className="font-semibold text-foreground">
                                        {piecesPreview}
                                    </span>{" "}
                                    ({data.boxes_received || 0} ×{" "}
                                    {medicine?.pack_size ?? 1})
                                </p>
                            </div>

                            <div className="grid gap-3">
                                <Label htmlFor="branch_id">Branch</Label>
                                <select
                                    id="branch_id"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={data.branch_id}
                                    onChange={(e) =>
                                        setData("branch_id", e.target.value)
                                    }
                                >
                                    <option value="">Select a branch</option>
                                    {branches.map((branch) => (
                                        <option
                                            key={branch.id}
                                            value={String(branch.id)}
                                        >
                                            {branch.branch_name}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={errors.branch_id} />
                            </div>

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
                                        type="date"
                                        value={data.expiry}
                                        onChange={(e) =>
                                            setData("expiry", e.target.value)
                                        }
                                    />
                                    <InputError message={errors.expiry} />
                                </div>
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
