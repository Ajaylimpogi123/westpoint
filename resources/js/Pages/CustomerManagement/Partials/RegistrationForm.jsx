import InputError from "@/Components/InputError";
import InputLabel from "@/Components/InputLabel";
import PrimaryButton from "@/Components/PrimaryButton";
import TextInput from "@/Components/TextInput";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { usePage } from "@inertiajs/react";
import useAddCustomer from "../Hooks/useAddCustomer";
import { CUSTOMER_TYPES } from "../lib/customerType";

export default function RegistrationForm({ branches, branchId, branchName }) {
    const { auth } = usePage().props;
    const roleId = auth?.user?.role_id;
    const isStaff = roleId === 1;
    const isAdmin = roleId === 2;

    const { data, setData, errors, processing, submit } = useAddCustomer(
        isStaff ? branchId : "",
    );

    return (
        <Card id="customer-registration">
            <CardHeader>
                <CardTitle>Register New Customer</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="max-w-xl">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <InputLabel htmlFor="first_name" value="First Name" />
                            <TextInput
                                id="first_name"
                                name="first_name"
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
                            <InputLabel htmlFor="last_name" value="Last Name" />
                            <TextInput
                                id="last_name"
                                name="last_name"
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

                    <div className="mt-4">
                        <InputLabel htmlFor="phone_number" value="Phone Number" />
                        <TextInput
                            id="phone_number"
                            name="phone_number"
                            value={data.phone_number}
                            className="mt-1 block w-full"
                            maxLength={11}
                            placeholder="09XXXXXXXXX"
                            onChange={(e) =>
                                setData(
                                    "phone_number",
                                    e.target.value.replace(/\D/g, ""),
                                )
                            }
                        />
                        <InputError
                            message={errors.phone_number}
                            className="mt-2"
                        />
                    </div>

                    <div className="mt-4">
                        <InputLabel htmlFor="email" value="Email" />
                        <TextInput
                            id="email"
                            type="email"
                            name="email"
                            value={data.email}
                            className="mt-1 block w-full"
                            onChange={(e) => setData("email", e.target.value)}
                        />
                        <InputError message={errors.email} className="mt-2" />
                    </div>

                    <div className="mt-4">
                        <InputLabel htmlFor="address" value="Address" />
                        <textarea
                            id="address"
                            name="address"
                            value={data.address}
                            rows={2}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            onChange={(e) => setData("address", e.target.value)}
                        />
                        <InputError message={errors.address} className="mt-2" />
                    </div>

                    <div className="mt-4">
                        <InputLabel htmlFor="customer_type" value="Customer Type" />
                        <select
                            id="customer_type"
                            name="customer_type"
                            value={data.customer_type}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            onChange={(e) =>
                                setData("customer_type", e.target.value)
                            }
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

                    {(isStaff || isAdmin) && (
                        <div className="mt-4">
                            <InputLabel
                                htmlFor="branch_id"
                                value="Branch Assignment"
                            />
                            {isStaff ? (
                                <TextInput
                                    id="branch_id"
                                    name="branch_id"
                                    value={branchName || "—"}
                                    className="mt-1 block w-full bg-gray-50"
                                    disabled
                                    readOnly
                                />
                            ) : (
                                <select
                                    id="branch_id"
                                    name="branch_id"
                                    value={data.branch_id}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    onChange={(e) =>
                                        setData("branch_id", e.target.value)
                                    }
                                    required
                                >
                                    <option value="">- Select a Branch -</option>
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>
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

                    <div className="mt-6 flex justify-end">
                        <PrimaryButton disabled={processing}>
                            Register Customer
                        </PrimaryButton>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
