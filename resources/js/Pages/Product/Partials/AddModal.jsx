import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogClose,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InputError from "@/Components/InputError";
import useAddProduct from "../Hooks/useAddProduct";

export default function AddProductModal({ children, categories }) {
    const {
        open,
        openModal,
        closeModal,
        data,
        setData,
        errors,
        processing,
        handleSubmit,
        handleFileChange,
        handleCategoryChange,
    } = useAddProduct();

    return (
        <>
            {/* Trigger */}
            <div onClick={openModal}>{children}</div>

            <Dialog open={open} onOpenChange={closeModal}>
                <DialogContent className="sm:max-w-[425px] rounded-md">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader className="pb-4">
                            <DialogTitle>Add Product</DialogTitle>
                        </DialogHeader>

                        <div className="grid gap-4">
                            {/* Category */}
                            <div className="grid gap-3">
                                <Label>Category</Label>
                                <select
                                    className="w-full px-3 py-2 border rounded-md"
                                    value={data.cat_id}
                                    onChange={(e) =>
                                        handleCategoryChange(e.target.value)
                                    }
                                >
                                    <option value="">Select a category</option>
                                    {categories.map((category) => (
                                        <option
                                            key={category.cat_id}
                                            value={category.cat_id}
                                        >
                                            {category.cat_name}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={errors.cat_id} />
                            </div>

                            {/* Product Name */}
                            <div className="grid gap-3">
                                <Label>Product Name</Label>
                                <Input
                                    value={data.pd_name}
                                    onChange={(e) =>
                                        setData("pd_name", e.target.value)
                                    }
                                />
                                <InputError message={errors.pd_name} />
                            </div>

                            {/* Description */}
                            <div className="grid gap-3">
                                <Label>Product Description</Label>
                                <Input
                                    value={data.pd_description}
                                    onChange={(e) =>
                                        setData(
                                            "pd_description",
                                            e.target.value,
                                        )
                                    }
                                />
                                <InputError message={errors.pd_description} />
                            </div>

                            {/* Price*/}
                            <div className="grid gap-3">
                                <Label>Selling Price</Label>
                                <Input
                                    type="number"
                                    value={data.pd_price}
                                    onChange={(e) =>
                                        setData("pd_price", e.target.value)
                                    }
                                />
                                <InputError message={errors.pd_price} />
                            </div>

                            {/* Cost*/}
                            <div className="grid gap-3">
                                <Label>Cost </Label>
                                <Input
                                    type="number"
                                    value={data.pd_cost}
                                    onChange={(e) =>
                                        setData("pd_cost", e.target.value)
                                    }
                                />
                                <InputError message={errors.pd_cost} />
                            </div>

                            {/* Qty*/}
                            <div className="grid gap-3">
                                <Label>Qty</Label>
                                <Input
                                    type="number"
                                    value={data.pd_qty}
                                    onChange={(e) =>
                                        setData("pd_qty", e.target.value)
                                    }
                                />
                                <InputError message={errors.pd_qty} />
                            </div>

                            {/* Minimum Qty */}
                            <div className="grid gap-3">
                                <Label>Threshold</Label>
                                <Input
                                    type="number"
                                    value={data.pd_mqty}
                                    onChange={(e) =>
                                        setData("pd_mqty", e.target.value)
                                    }
                                />
                                <InputError message={errors.pd_mqty} />
                            </div>

                            {/* Image */}
                            <div className="grid gap-2">
                                <Label>Product Image</Label>
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                                <InputError message={errors.pd_image} />
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
                                Submit
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
