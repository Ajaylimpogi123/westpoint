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
import useAddCategory from "../Hooks/useAddCategory";

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
        handleFileChange,
    } = useAddCategory();

    return (
        <>
            {/* Trigger */}
            <div onClick={openModal}>{children}</div>

            <Dialog open={open} onOpenChange={closeModal}>
                <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader className="pb-4">
                            <DialogTitle>Add Category</DialogTitle>
                            <DialogDescription />
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
                                <InputError message={errors.cat_image} />
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
