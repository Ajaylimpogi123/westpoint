import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CUSTOMER_TYPES } from "@/Pages/CustomerManagement/lib/customerType";
import { createCustomer } from "../lib/posCustomerApi";

export default function NewCustomerModal({
    branchId,
    branchName,
    branches = [],
    roleId,
    onCustomerCreated,
    disabled = false,
}) {
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState({});
    const [form, setForm] = useState({
        first_name: "",
        last_name: "",
        phone_number: "",
        customer_type: "Regular",
        branch_id: roleId === 2 ? "" : String(branchId ?? ""),
    });

    const isAdmin = roleId === 2;

    const resetForm = () => {
        setForm({
            first_name: "",
            last_name: "",
            phone_number: "",
            customer_type: "Regular",
            branch_id: isAdmin ? "" : String(branchId ?? ""),
        });
        setErrors({});
    };

    const updateField = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
        setErrors((current) => ({ ...current, [field]: undefined }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        try {
            const payload = {
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                phone_number: form.phone_number,
                customer_type: form.customer_type,
            };

            if (isAdmin) {
                payload.branch_id = Number(form.branch_id);
            }

            const data = await createCustomer(payload);

            toast.success("Customer registered successfully.");
            onCustomerCreated?.(data.customer);
            setOpen(false);
            resetForm();
        } catch (error) {
            if (error?.response?.status === 422) {
                setErrors(error.response.data.errors ?? {});
            } else {
                toast.error(
                    error?.response?.data?.message ||
                        "Failed to register customer.",
                );
            }
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) {
                    resetForm();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    disabled={disabled}
                    aria-label="Add new customer"
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>New Customer</DialogTitle>
                    <DialogDescription>
                        Quickly register a customer without leaving POS.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="pos_first_name">First Name</Label>
                            <Input
                                id="pos_first_name"
                                value={form.first_name}
                                onChange={(event) =>
                                    updateField("first_name", event.target.value)
                                }
                                required
                            />
                            {errors.first_name && (
                                <p className="text-sm text-destructive">
                                    {errors.first_name[0]}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="pos_last_name">Last Name</Label>
                            <Input
                                id="pos_last_name"
                                value={form.last_name}
                                onChange={(event) =>
                                    updateField("last_name", event.target.value)
                                }
                                required
                            />
                            {errors.last_name && (
                                <p className="text-sm text-destructive">
                                    {errors.last_name[0]}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="pos_phone_number">Phone Number</Label>
                        <Input
                            id="pos_phone_number"
                            value={form.phone_number}
                            onChange={(event) =>
                                updateField(
                                    "phone_number",
                                    event.target.value.replace(/\D/g, ""),
                                )
                            }
                            maxLength={11}
                            placeholder="09XXXXXXXXX"
                            required
                        />
                        {errors.phone_number && (
                            <p className="text-sm text-destructive">
                                {errors.phone_number[0]}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="pos_customer_type">Customer Type</Label>
                        <Select
                            value={form.customer_type}
                            onValueChange={(value) =>
                                updateField("customer_type", value)
                            }
                        >
                            <SelectTrigger id="pos_customer_type">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CUSTOMER_TYPES.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {type}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.customer_type && (
                            <p className="text-sm text-destructive">
                                {errors.customer_type[0]}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="pos_branch">Branch</Label>
                        {isAdmin ? (
                            <Select
                                value={form.branch_id}
                                onValueChange={(value) =>
                                    updateField("branch_id", value)
                                }
                            >
                                <SelectTrigger id="pos_branch">
                                    <SelectValue placeholder="Select a branch" />
                                </SelectTrigger>
                                <SelectContent>
                                    {branches.map((branch) => (
                                        <SelectItem
                                            key={branch.id}
                                            value={String(branch.id)}
                                        >
                                            {branch.branch_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                id="pos_branch"
                                value={branchName || "—"}
                                disabled
                                readOnly
                            />
                        )}
                        {errors.branch_id && (
                            <p className="text-sm text-destructive">
                                {errors.branch_id[0]}
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={processing}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? "Saving..." : "Save Customer"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
