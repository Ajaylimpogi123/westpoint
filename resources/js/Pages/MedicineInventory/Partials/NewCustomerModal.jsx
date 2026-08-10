import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/Components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/Components/ui/dialog";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { UserPlus } from "lucide-react";
import { createCustomer } from "../lib/customersApi";

const CUSTOMER_TYPES = ["Regular", "Senior Citizen", "PWD"];

const emptyForm = () => ({
    first_name: "",
    last_name: "",
    customer_type: "Regular",
    senior_id_number: "",
    pwd_id_number: "",
    email: "",
    address: "",
});

export default function NewCustomerModal({ branchId, onCreated, children }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [errors, setErrors] = useState({});
    const [processing, setProcessing] = useState(false);

    const openModal = () => {
        setForm(emptyForm());
        setErrors({});
        setOpen(true);
    };

    const closeModal = () => {
        setOpen(false);
        setForm(emptyForm());
        setErrors({});
    };

    const updateField = (field, value) =>
        setForm((current) => ({ ...current, [field]: value }));

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!branchId) {
            toast.error("Select a branch before adding a customer.");
            return;
        }

        setProcessing(true);
        setErrors({});

        try {
            const response = await createCustomer({
                branch_id: branchId,
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                customer_type: form.customer_type,
                senior_id_number:
                    form.customer_type === "Senior Citizen"
                        ? form.senior_id_number.trim() || null
                        : null,
                pwd_id_number:
                    form.customer_type === "PWD"
                        ? form.pwd_id_number.trim() || null
                        : null,
                email: form.email.trim() || null,
                address: form.address.trim() || null,
            });

            onCreated?.(response.customer);
            closeModal();
        } catch (error) {
            if (error?.response?.status === 422) {
                setErrors(error.response.data.errors ?? {});
            } else {
                toast.error("Could not add customer. Please try again.");
            }
        } finally {
            setProcessing(false);
        }
    };

    return (
        <>
            <div onClick={openModal}>{children}</div>

            <Dialog
                open={open}
                onOpenChange={(isOpen) => !isOpen && closeModal()}
            >
                <DialogContent className="max-w-md">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>New Customer</DialogTitle>
                            <DialogDescription>
                                Add a customer for this branch.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 py-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="new_customer_first_name">
                                        First Name
                                    </Label>
                                    <Input
                                        id="new_customer_first_name"
                                        value={form.first_name}
                                        onChange={(e) =>
                                            updateField(
                                                "first_name",
                                                e.target.value,
                                            )
                                        }
                                    />
                                    {errors.first_name && (
                                        <p className="text-sm text-destructive">
                                            {errors.first_name[0]}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="new_customer_last_name">
                                        Last Name
                                    </Label>
                                    <Input
                                        id="new_customer_last_name"
                                        value={form.last_name}
                                        onChange={(e) =>
                                            updateField(
                                                "last_name",
                                                e.target.value,
                                            )
                                        }
                                    />
                                    {errors.last_name && (
                                        <p className="text-sm text-destructive">
                                            {errors.last_name[0]}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="new_customer_type">
                                    Customer Type
                                </Label>
                                <select
                                    id="new_customer_type"
                                    value={form.customer_type}
                                    onChange={(e) =>
                                        updateField(
                                            "customer_type",
                                            e.target.value,
                                        )
                                    }
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    {CUSTOMER_TYPES.map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                                {errors.customer_type && (
                                    <p className="text-sm text-destructive">
                                        {errors.customer_type[0]}
                                    </p>
                                )}
                            </div>

                            {form.customer_type === "Senior Citizen" && (
                                <div className="grid gap-2">
                                    <Label htmlFor="new_customer_senior_id">
                                        Senior Citizen ID Number
                                    </Label>
                                    <Input
                                        id="new_customer_senior_id"
                                        value={form.senior_id_number}
                                        onChange={(e) =>
                                            updateField(
                                                "senior_id_number",
                                                e.target.value,
                                            )
                                        }
                                    />
                                    {errors.senior_id_number && (
                                        <p className="text-sm text-destructive">
                                            {errors.senior_id_number[0]}
                                        </p>
                                    )}
                                </div>
                            )}

                            {form.customer_type === "PWD" && (
                                <div className="grid gap-2">
                                    <Label htmlFor="new_customer_pwd_id">
                                        PWD ID Number
                                    </Label>
                                    <Input
                                        id="new_customer_pwd_id"
                                        value={form.pwd_id_number}
                                        onChange={(e) =>
                                            updateField(
                                                "pwd_id_number",
                                                e.target.value,
                                            )
                                        }
                                    />
                                    {errors.pwd_id_number && (
                                        <p className="text-sm text-destructive">
                                            {errors.pwd_id_number[0]}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor="new_customer_email">
                                    Email
                                </Label>
                                <Input
                                    id="new_customer_email"
                                    type="email"
                                    value={form.email}
                                    onChange={(e) =>
                                        updateField("email", e.target.value)
                                    }
                                    placeholder="Optional"
                                />
                                {errors.email && (
                                    <p className="text-sm text-destructive">
                                        {errors.email[0]}
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="new_customer_address">
                                    Address
                                </Label>
                                <Input
                                    id="new_customer_address"
                                    value={form.address}
                                    onChange={(e) =>
                                        updateField("address", e.target.value)
                                    }
                                    placeholder="Optional"
                                />
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
                            <Button
                                type="submit"
                                disabled={
                                    processing ||
                                    !form.first_name.trim() ||
                                    !form.last_name.trim()
                                }
                            >
                                <UserPlus className="mr-2 h-4 w-4" />
                                Add Customer
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
