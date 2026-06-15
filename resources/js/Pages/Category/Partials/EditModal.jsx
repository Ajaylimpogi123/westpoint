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
import useEditCategory from "../Hooks/useEditCategory";

export default function EditModal({ category, children }) {
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
    } = useEditCategory(category);

    return (
        <>
            {/* Trigger */}
            <div onClick={openModal}>{children}</div>

            <Dialog open={open} onOpenChange={closeModal}>
                <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>Edit Category</DialogTitle>
                            <DialogDescription>
                                Update category details
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4">
                            <div className="grid gap-3">
                                <Label>Category Name</Label>
                                <Input
                                    value={data.cat_name}
                                    onChange={(e) =>
                                        setData("cat_name", e.target.value)
                                    }
                                />
                                <InputError message={errors.cat_name} />
                            </div>

                            <div className="grid gap-3">
                                <Label>Category Description</Label>
                                <Input
                                    value={data.cat_description}
                                    onChange={(e) =>
                                        setData(
                                            "cat_description",
                                            e.target.value,
                                        )
                                    }
                                />
                                <InputError message={errors.cat_description} />
                            </div>

                            <div className="grid gap-2">
                                <Label>Category Image</Label>
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />

                                {/* Existing image */}
                                {category.cat_image && !data.cat_image && (
                                    <div className="mt-2">
                                        <p className="text-xs text-gray-500">
                                            Current image:
                                        </p>
                                        <img
                                            src={`/storage/${category.cat_image}`}
                                            className="w-20 h-20 object-cover rounded"
                                        />
                                    </div>
                                )}

                                {/* New image selected */}
                                {data.cat_image instanceof File && (
                                    <p className="text-xs text-green-500">
                                        New image: {data.cat_image.name}
                                    </p>
                                )}

                                <InputError message={errors.cat_image} />
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
