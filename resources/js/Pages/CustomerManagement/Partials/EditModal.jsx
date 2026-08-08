import InputError from "@/Components/InputError";
import InputLabel from "@/Components/InputLabel";
import TextInput from "@/Components/TextInput";
import { Button } from "@/Components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogClose,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/Components/ui/dialog";
import { usePage } from "@inertiajs/react";
import useEditCustomer from "../Hooks/useEditCustomer";
import { CUSTOMER_TYPES } from "../lib/customerType";

export default function EditModal({
    customer,
    branches,
    canFilterBranches,
    children,
}) {
    const { auth } = usePage().props;
    const roleId = auth?.user?.role_id;
    const isStaff = roleId === 1;

    const {
        open,
        openModal,
        closeModal,
        data,
        setData,
        errors,
        processing,
        handleSubmit,
    } = useEditCustomer(customer, canFilterBranches);

    const customerName = `${customer.first_name} ${customer.last_name}`.trim();

    return (
        <>
            <div onClick={openModal}>{children}</div>

            <Dialog open={open} onOpenChange={closeModal}>
                <DialogContent className="sm:max-w-[500px]">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>Edit Customer</DialogTitle>
                            <DialogDescription>
                                Update details for {customerName}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <InputLabel
                                        htmlFor="edit_first_name"
                                        value="First Name"
                                    />
                                    <TextInput
                                        id="edit_first_name"
                                        value={data.first_name}
                                        className="mt-1 block w-full"
                                        onChange={(e) =>
                                            setData("first_name", e.target.value)
                                        }
                                        required
                                    />
                                    <InputError
                                        message={errors.first_name}
                                        className="mt-2"
                                    />
                                </div>

                                <div>
                                    <InputLabel
                                        htmlFor="edit_last_name"
                                        value="Last Name"
                                    />
                                    <TextInput
                                        id="edit_last_name"
                                        value={data.last_name}
                                        className="mt-1 block w-full"
                                        onChange={(e) =>
                                            setData("last_name", e.target.value)
                                        }
                                        required
                                    />
                                    <InputError
                                        message={errors.last_name}
                                        className="mt-2"
                                    />
                                </div>
                            </div>

                            <div>
                                <InputLabel htmlFor="edit_email" value="Email" />
                                <TextInput
                                    id="edit_email"
                                    type="email"
                                    value={data.email}
                                    className="mt-1 block w-full"
                                    onChange={(e) =>
                                        setData("email", e.target.value)
                                    }
                                />
                                <InputError
                                    message={errors.email}
                                    className="mt-2"
                                />
                            </div>

                            <div>
                                <InputLabel
                                    htmlFor="edit_address"
                                    value="Address"
                                />
                                <textarea
                                    id="edit_address"
                                    value={data.address}
                                    rows={2}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    onChange={(e) =>
                                        setData("address", e.target.value)
                                    }
                                />
                                <InputError
                                    message={errors.address}
                                    className="mt-2"
                                />
                            </div>

                            <div>
                                <InputLabel
                                    htmlFor="edit_customer_type"
                                    value="Customer Type"
                                />
                                <select
                                    id="edit_customer_type"
                                    value={data.customer_type}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    onChange={(e) => {
                                        const type = e.target.value;
                                        setData("customer_type", type);
                                        if (type !== "Senior Citizen") {
                                            setData("senior_id_number", "");
                                        }
                                        if (type !== "PWD") {
                                            setData("pwd_id_number", "");
                                        }
                                    }}
                                    required
                                >
                                    {CUSTOMER_TYPES.map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                                <InputError
                                    message={errors.customer_type}
                                    className="mt-2"
                                />
                            </div>

                            {data.customer_type === "Senior Citizen" && (
                                <div>
                                    <InputLabel
                                        htmlFor="edit_senior_id_number"
                                        value="Senior ID Number"
                                    />
                                    <TextInput
                                        id="edit_senior_id_number"
                                        value={data.senior_id_number}
                                        className="mt-1 block w-full"
                                        maxLength={50}
                                        onChange={(e) =>
                                            setData(
                                                "senior_id_number",
                                                e.target.value,
                                            )
                                        }
                                        required
                                    />
                                    <InputError
                                        message={errors.senior_id_number}
                                        className="mt-2"
                                    />
                                </div>
                            )}

                            {data.customer_type === "PWD" && (
                                <div>
                                    <InputLabel
                                        htmlFor="edit_pwd_id_number"
                                        value="PWD ID Number"
                                    />
                                    <TextInput
                                        id="edit_pwd_id_number"
                                        value={data.pwd_id_number}
                                        className="mt-1 block w-full"
                                        maxLength={50}
                                        onChange={(e) =>
                                            setData(
                                                "pwd_id_number",
                                                e.target.value,
                                            )
                                        }
                                        required
                                    />
                                    <InputError
                                        message={errors.pwd_id_number}
                                        className="mt-2"
                                    />
                                </div>
                            )}

                            <div>
                                <InputLabel
                                    htmlFor="edit_status"
                                    value="Status"
                                />
                                <select
                                    id="edit_status"
                                    value={data.status}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    onChange={(e) =>
                                        setData("status", e.target.value)
                                    }
                                    required
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                                <InputError
                                    message={errors.status}
                                    className="mt-2"
                                />
                            </div>

                            {(isStaff || canFilterBranches) && (
                                <div>
                                    <InputLabel
                                        htmlFor="edit_branch_id"
                                        value="Branch Assignment"
                                    />
                                    {isStaff ? (
                                        <TextInput
                                            id="edit_branch_id"
                                            value={
                                                customer.branch?.branch_name ||
                                                "—"
                                            }
                                            className="mt-1 block w-full bg-gray-50"
                                            disabled
                                            readOnly
                                        />
                                    ) : (
                                        <select
                                            id="edit_branch_id"
                                            value={data.branch_id}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                            onChange={(e) =>
                                                setData(
                                                    "branch_id",
                                                    e.target.value,
                                                )
                                            }
                                            required
                                        >
                                            <option value="">
                                                - Select a Branch -
                                            </option>
                                            {branches.map((branch) => (
                                                <option
                                                    key={branch.id}
                                                    value={branch.id}
                                                >
                                                    {branch.branch_name}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    <InputError
                                        message={errors.branch_id}
                                        className="mt-2"
                                    />
                                </div>
                            )}
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
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
