import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogClose,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InputError from "@/Components/InputError";
import { useForm } from "@inertiajs/react";
import TextInput from "@/Components/TextInput";
import InputLabel from "@/Components/InputLabel";

export default function EditModal({ product, children }) {
    const [open, setOpen] = useState(false);
    const { data, setData, patch, errors, processing, reset } = useForm({
        pd_name: product.pd_name || "",
        pd_description: product.pd_description || "",
        pd_image: product.pd_image || null,
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        // Prepare the data
        const formData = {
            pd_name: data.pd_name || "",
            pd_description: data.pd_description || null,
            pd_image: data.pd_image || null,
        };
        console.log("Submitting data:", formData);

        patch(route("product.update", product.pd_id), formData, {
            onSuccess: () => {
                setOpen(false);
                reset();
            },
            forceFormData: true,
            preserveScroll: true,
        });
    };
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setData("pd_image", file);
    };
    const handleClose = () => {
        setOpen(false);
    };

    return (
        <>
            {/* Trigger - can be a button or any child element */}
            <div onClick={() => setOpen(true)}>{children}</div>

            <Dialog open={open} onOpenChange={handleClose}>
                {/* <DialogTrigger asChild>
                        <Button variant="outline">Open Dialog</Button>
                    </DialogTrigger> */}
                <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>Edit Product</DialogTitle>
                            <DialogDescription>
                                Make changes to your profile here. Click save
                                when you&apos;re done.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4">
                            <div className="grid gap-3">
                                <Label htmlFor="name-1">Product Name</Label>
                                <Input
                                    id="pd_name"
                                    value={data.pd_name}
                                    onChange={(e) =>
                                        setData("pd_name", e.target.value)
                                    }
                                    placeholder="Enter product name"
                                />
                                <InputError
                                    className="mt-2"
                                    message={errors.pd_name}
                                />
                            </div>
                            <div className="grid gap-3">
                                <Label htmlFor="username-1">
                                    Product Description
                                </Label>
                                <Input
                                    id="pd_description"
                                    value={data.pd_description}
                                    onChange={(e) =>
                                        setData(
                                            "pd_description",
                                            e.target.value,
                                        )
                                    }
                                    name="product description"
                                    placeholder="Enter product description"
                                />
                                <InputError
                                    className="mt-2"
                                    message={errors.cat_description}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label
                                    htmlFor="pd_image"
                                    className="text-sm font-medium"
                                >
                                    Product Image
                                </Label>
                                <Input
                                    id="pd_image"
                                    type="file"
                                    onChange={handleFileChange}
                                    accept="image/*"
                                    className="cursor-pointer"
                                />
                                {product.pd_image && !data.pd_image && (
                                    <div className="mt-2">
                                        <p className="text-xs text-gray-500">
                                            Current image:
                                        </p>
                                        <img
                                            src={`/storage/${product.pd_image}`}
                                            alt="Current"
                                            className="w-20 h-20 object-cover rounded mt-1"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            {product.pd_image}
                                        </p>
                                    </div>
                                )}
                                {data.pd_image instanceof File && (
                                    <p className="text-xs text-green-500 mt-1">
                                        New image selected: {data.pd_image.name}
                                    </p>
                                )}
                                <InputError message={errors.pd_image} />
                            </div>
                        </div>

                        <DialogFooter>
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleClose}
                                    disabled={processing}
                                >
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button type="submit" disabled={processing}>
                                submit
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
