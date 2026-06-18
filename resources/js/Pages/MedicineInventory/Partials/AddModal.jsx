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
import useAddMedicine from "../Hooks/useAddMedicine";

export default function AddModal({ children }) {
    const {
        open,
        openModal,
        closeModal,
        data,
        setData,
        errors,
        processing,
        handleSubmit,
    } = useAddMedicine();

    return (
        <>
            <div onClick={openModal}>{children}</div>

            <Dialog open={open} onOpenChange={closeModal}>
                <DialogContent className="sm:max-w-[520px]">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader className="pb-4">
                            <DialogTitle>Add Medicine</DialogTitle>
                            <DialogDescription>
                                Register a new medicine product. Retail price
                                is per piece; wholesale price is per box.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4">
                            <div className="grid gap-3">
                                <Label htmlFor="med_name">Medicine Name</Label>
                                <Input
                                    id="med_name"
                                    value={data.med_name}
                                    onChange={(e) =>
                                        setData("med_name", e.target.value)
                                    }
                                    placeholder="e.g. Paracetamol"
                                />
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
                                    <Input
                                        id="form"
                                        value={data.form}
                                        onChange={(e) =>
                                            setData("form", e.target.value)
                                        }
                                        placeholder="e.g. Tablet"
                                    />
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
                                            setData(
                                                "pack_size",
                                                e.target.value,
                                            )
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
                                Add Medicine
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
