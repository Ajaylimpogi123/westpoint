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

export default function AddModal({ product, children, categories }) {
    const [open, setOpen] = useState(false);
    const { data, setData, post, errors, processing, reset } = useForm({
        pd_name: "",
        pd_description: "",
        pd_image: null,
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        post(route("product.store"), {
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

    const handleCategoryChange = (field, value) => {
        setData(field, value);
    };

    return (
        <>
            {/* Trigger - can be a button or any child element */}
            <div onClick={() => setOpen(true)}>{children}</div>

            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="sm:max-w-[425px] rounded-md">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader className="pb-4">
                            <DialogTitle>Add product</DialogTitle>
                            <DialogDescription></DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4">
                            <div className="grid gap-3">
                                {/* Category Dropdown */}
                                <Label htmlFor="cat_id">Category</Label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                    id="cat_id"
                                    value={data.cat_id}
                                    onChange={(e) =>
                                        handleCategoryChange(
                                            "cat_id",
                                            e.target.value,
                                        )
                                    }
                                >
                                    <option value="">Select a category</option>
                                    {categories.map((category) => (
                                        <option
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                            key={category.cat_id}
                                            value={category.cat_id}
                                        >
                                            {category.cat_name}
                                        </option>
                                    ))}
                                </select>
                                <InputError
                                    className="mt-2"
                                    message={errors.cat_id}
                                />
                            </div>
                            <div className="grid gap-3">
                                <Label htmlFor="name-1">Product Name</Label>
                                <Input
                                    id="pd_name"
                                    value={data.pd_name}
                                    onChange={(e) =>
                                        setData("pd_name", e.target.value)
                                    }
                                    placeholder="Enter product name"
                                    className="rounded-md"
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
                                    className="rounded-md"
                                />
                                <InputError
                                    className="mt-2"
                                    message={errors.pd_description}
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
                                    className="cursor-pointer rounded-md"
                                />

                                <InputError message={errors.pd_image} />
                            </div>
                        </div>

                        <DialogFooter className="mt-4">
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
