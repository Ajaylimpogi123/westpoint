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

import useAddTable from "../Hooks/useAddTable";
export default function AddModal({ table, children }) {
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
    } = useAddTable();

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
                        <DialogHeader className="pb-4">
                            <DialogTitle>Edit Category</DialogTitle>
                            <DialogDescription></DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4">
                            <div className="grid gap-3">
                                <Label htmlFor="name-1">Table Number</Label>
                                <Input
                                    type="number"
                                    id="table_number"
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
                                    id="table_description"
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

                        <DialogFooter className="mt-4">
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
