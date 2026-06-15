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
import useEditTable from "../Hooks/useEditTable";
export default function EditModal({ table, children }) {
    // console.log("this is table", table);
    const {
        open,
        openModal,
        closeModal,
        data,
        setData,
        errors,
        processing,
        handleSubmit,
    } = useEditTable(table);
    return (
        <>
            {/* Trigger - can be a button or any child element */}
            <div onClick={openModal}>{children}</div>

            <Dialog open={open} onOpenChange={closeModal}>
                {/* <DialogTrigger asChild>
                        <Button variant="outline">Open Dialog</Button>
                    </DialogTrigger> */}
                <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>Edit Table</DialogTitle>
                            <DialogDescription>
                                Make changes to your profile here. Click save
                                when you&apos;re done.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4">
                            <div className="grid gap-3">
                                <Label htmlFor="name-1">Table Number</Label>
                                <Input
                                    id="t_number"
                                    type="number"
                                    value={data.t_number}
                                    onChange={(e) =>
                                        setData("t_number", e.target.value)
                                    }
                                    placeholder="Enter table number"
                                />
                                <InputError
                                    className="mt-2"
                                    message={errors.t_number}
                                />
                            </div>
                            <div className="grid gap-3">
                                <Label htmlFor="username-1">
                                    Table Description
                                </Label>
                                <Input
                                    id="t_description"
                                    value={data.t_description}
                                    onChange={(e) =>
                                        setData("t_description", e.target.value)
                                    }
                                    name="Table description"
                                    placeholder="Enter table description"
                                />
                                <InputError
                                    className="mt-2"
                                    message={errors.t_description}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={closeModal}
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
