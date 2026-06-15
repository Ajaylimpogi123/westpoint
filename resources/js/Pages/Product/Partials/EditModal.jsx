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
import useEditProduct from "../Hooks/useEditProduct";

export default function EditProductModal({ product, children, categories }) {
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
    } = useEditProduct(product);

    return (
        <>
            {/* Trigger */}
            <div onClick={openModal}>{children}</div>

            <Dialog open={open} onOpenChange={closeModal}>
                <DialogContent className="sm:max-w-[425px] rounded-md">
                    <form onSubmit={handleSubmit} >
                        <DialogHeader>
                            <DialogTitle className="mb-2">
                                Edit Product
                            </DialogTitle>
                            {/* <DialogDescription>
                                Update product details
                            </DialogDescription> */}
                        </DialogHeader>

                        <div className="grid gap-4">
                            {/* Category - ADD THIS */}
                            <div className="grid gap-2">
                                <Label>Category</Label>
                                <select
                                    value={data.cat_id}
                                    onChange={(e) =>
                                        setData("cat_id", e.target.value)
                                    }
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="">Select a category</option>
                                    {categories?.map((cat) => (
                                        <option
                                            key={cat.cat_id}
                                            value={cat.cat_id}
                                        >
                                            {cat.cat_name}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={errors.cat_id} />
                            </div>
                            {/* Product Name */}
                            <div className="grid gap-2">
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
                            <div className="grid gap-2">
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
                            {/* Qty */}
                            <div className="grid gap-2">
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
                            {/* Qty */}
                            <div className="grid gap-2">
                                <Label>Cost</Label>
                                <Input
                                    type="number"
                                    value={data.pd_cost}
                                    onChange={(e) =>
                                        setData("pd_cost", e.target.value)
                                    }
                                />
                                <InputError message={errors.pd_cost} />
                            </div>
                            {/* Qty */}
                            <div className="grid gap-2">
                                <Label>Product Qty</Label>
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
                            <div className="grid gap-2">
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

                                {product.pd_image && !data.pd_image && (
                                    <div className="mt-2">
                                        <p className="text-xs text-gray-500">
                                            Current image:
                                        </p>
                                        <img
                                            src={`/storage/${product.pd_image}`}
                                            className="w-20 h-20 object-cover rounded"
                                        />
                                    </div>
                                )}

                                {data.pd_image instanceof File && (
                                    <p className="text-xs text-green-500">
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
                                    disabled={processing}
                                    onClick={closeModal}
                                >
                                    Cancel
                                </Button>
                            </DialogClose>

                            <Button type="submit" disabled={processing}>
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
