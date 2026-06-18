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
import useEditMedicine from "../Hooks/useEditMedicine";

export default function EditModal({ medicine, children }) {
    const {
        open,
        openModal,
        closeModal,
        data,
        setData,
        errors,
        processing,
        handleSubmit,
    } = useEditMedicine(medicine);

    return (
        <>
            <div onClick={openModal}>{children}</div>

            <Dialog open={open} onOpenChange={closeModal}>
                <DialogContent className="sm:max-w-[520px]">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>Edit Medicine</DialogTitle>
                            <DialogDescription>
                                Update medicine details and pricing
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4">
                            <div className="grid gap-3">
                                <Label htmlFor="edit_med_name">
                                    Medicine Name
                                </Label>
                                <Input
                                    id="edit_med_name"
                                    value={data.med_name}
                                    onChange={(e) =>
                                        setData("med_name", e.target.value)
                                    }
                                />
                                <InputError message={errors.med_name} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-3">
                                    <Label htmlFor="edit_dose">Dose</Label>
                                    <Input
                                        id="edit_dose"
                                        value={data.dose}
                                        onChange={(e) =>
                                            setData("dose", e.target.value)
                                        }
                                    />
                                    <InputError message={errors.dose} />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="edit_form">Form</Label>
                                    <Input
                                        id="edit_form"
                                        value={data.form}
                                        onChange={(e) =>
                                            setData("form", e.target.value)
                                        }
                                    />
                                    <InputError message={errors.form} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-3">
                                    <Label htmlFor="edit_pack_size">
                                        Pack Size
                                    </Label>
                                    <Input
                                        id="edit_pack_size"
                                        type="number"
                                        min="1"
                                        value={data.pack_size}
                                        onChange={(e) =>
                                            setData(
                                                "pack_size",
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <InputError message={errors.pack_size} />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="edit_brand_name">
                                        Brand
                                    </Label>
                                    <Input
                                        id="edit_brand_name"
                                        value={data.brand_name}
                                        onChange={(e) =>
                                            setData(
                                                "brand_name",
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <InputError message={errors.brand_name} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-3">
                                    <Label htmlFor="edit_retail_price">
                                        Retail Price (per piece)
                                    </Label>
                                    <Input
                                        id="edit_retail_price"
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
                                    />
                                    <InputError message={errors.retail_price} />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="edit_wholesale_price">
                                        Wholesale Price (per box)
                                    </Label>
                                    <Input
                                        id="edit_wholesale_price"
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
                                    />
                                    <InputError
                                        message={errors.wholesale_price}
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
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
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
