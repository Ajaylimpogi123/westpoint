import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import InputError from "@/Components/InputError";
import InputLabel from "@/Components/InputLabel";
import PrimaryButton from "@/Components/PrimaryButton";
import TextInput from "@/Components/TextInput";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Head, router, useForm } from "@inertiajs/react";
import { useEffect } from "react";

export default function SuperadminDashboard({ branches, roles, users, filters }) {
    const {
        data: registerData,
        setData: setRegisterData,
        post,
        processing,
        errors: registerErrors,
        reset: resetRegister,
    } = useForm({
        name: "",
        email: "",
        password: "",
        password_confirmation: "",
        branch_id: "",
        role_id: "",
    });

    const { data: filterData, setData: setFilterData } = useForm({
        role_id: filters?.role_id || "",
        branch_id: filters?.branch_id || "",
    });

    useEffect(() => {
        setFilterData({
            role_id: filters?.role_id || "",
            branch_id: filters?.branch_id || "",
        });
    }, [filters]);

    useEffect(() => {
        if (window.location.hash === "#user-registration") {
            document.getElementById("user-registration")?.scrollIntoView({
                behavior: "smooth",
            });
        }
    }, []);

    const submitRegistration = (e) => {
        e.preventDefault();

        post(route("register"), {
            onFinish: () => resetRegister("password", "password_confirmation"),
            preserveScroll: true,
        });
    };

    const applyFilters = (overrides = {}) => {
        const nextFilters = {
            role_id: overrides.role_id ?? filterData.role_id,
            branch_id: overrides.branch_id ?? filterData.branch_id,
        };

        router.get(route("superadmin-dashboard"), nextFilters, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ["users", "filters"],
        });
    };

    const clearFilters = () => {
        setFilterData({ role_id: "", branch_id: "" });
        router.get(
            route("superadmin-dashboard"),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["users", "filters"],
            },
        );
    };

    const goToPage = (page) => {
        router.get(
            route("superadmin-dashboard"),
            {
                role_id: filterData.role_id,
                branch_id: filterData.branch_id,
                page,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["users", "filters"],
            },
        );
    };

    const hasActiveFilters = filterData.role_id || filterData.branch_id;

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Superadmin Dashboard
                </h2>
            }
        >
            <Head title="Superadmin Dashboard" />

            <div className="relative z-10 py-12">
                 <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
                    <Card id="user-registration">
                        <CardHeader>
                            <CardTitle>User Registration</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitRegistration} className="max-w-xl">
                                <div>
                                    <InputLabel htmlFor="name" value="Name" />
                                    <TextInput
                                        id="name"
                                        name="name"
                                        value={registerData.name}
                                        className="mt-1 block w-full"
                                        autoComplete="name"
                                        onChange={(e) =>
                                            setRegisterData("name", e.target.value)
                                        }
                                        required
                                    />
                                    <InputError
                                        message={registerErrors.name}
                                        className="mt-2"
                                    />
                                </div>

                                <div className="mt-4">
                                    <InputLabel htmlFor="email" value="Email" />
                                    <TextInput
                                        id="email"
                                        type="email"
                                        name="email"
                                        value={registerData.email}
                                        className="mt-1 block w-full"
                                        autoComplete="username"
                                        onChange={(e) =>
                                            setRegisterData("email", e.target.value)
                                        }
                                        required
                                    />
                                    <InputError
                                        message={registerErrors.email}
                                        className="mt-2"
                                    />
                                </div>

                                <div className="mt-4">
                                    <InputLabel htmlFor="branch_id" value="Branch" />
                                    <select
                                        id="branch_id"
                                        name="branch_id"
                                        value={registerData.branch_id}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        onChange={(e) =>
                                            setRegisterData("branch_id", e.target.value)
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
                                    <InputError
                                        message={registerErrors.branch_id}
                                        className="mt-2"
                                    />
                                </div>

                                <div className="mt-4">
                                    <InputLabel htmlFor="role_id" value="Role" />
                                    <select
                                        id="role_id"
                                        name="role_id"
                                        value={registerData.role_id}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        onChange={(e) =>
                                            setRegisterData("role_id", e.target.value)
                                        }
                                        required
                                    >
                                        <option value="">- Select a Role -</option>
                                        {roles.map((role) => (
                                            <option key={role.id} value={role.id}>
                                                {role.role_name}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError
                                        message={registerErrors.role_id}
                                        className="mt-2"
                                    />
                                </div>

                                <div className="mt-4">
                                    <InputLabel htmlFor="password" value="Password" />
                                    <TextInput
                                        id="password"
                                        type="password"
                                        name="password"
                                        value={registerData.password}
                                        className="mt-1 block w-full"
                                        autoComplete="new-password"
                                        onChange={(e) =>
                                            setRegisterData("password", e.target.value)
                                        }
                                        required
                                    />
                                    <InputError
                                        message={registerErrors.password}
                                        className="mt-2"
                                    />
                                </div>

                                <div className="mt-4">
                                    <InputLabel
                                        htmlFor="password_confirmation"
                                        value="Confirm Password"
                                    />
                                    <TextInput
                                        id="password_confirmation"
                                        type="password"
                                        name="password_confirmation"
                                        value={registerData.password_confirmation}
                                        className="mt-1 block w-full"
                                        autoComplete="new-password"
                                        onChange={(e) =>
                                            setRegisterData(
                                                "password_confirmation",
                                                e.target.value,
                                            )
                                        }
                                        required
                                    />
                                    <InputError
                                        message={registerErrors.password_confirmation}
                                        className="mt-2"
                                    />
                                </div>

                                <div className="mt-6 flex justify-end">
                                    <PrimaryButton disabled={processing}>
                                        Register User
                                    </PrimaryButton>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Users</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                <div className="flex-1">
                                    <InputLabel htmlFor="filter_role" value="Filter by Role" />
                                    <select
                                        id="filter_role"
                                        value={filterData.role_id}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        onChange={(e) => {
                                            const role_id = e.target.value;
                                            setFilterData("role_id", role_id);
                                            applyFilters({ role_id });
                                        }}
                                    >
                                        <option value="">All Roles</option>
                                        {roles.map((role) => (
                                            <option key={role.id} value={role.id}>
                                                {role.role_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex-1">
                                    <InputLabel
                                        htmlFor="filter_branch"
                                        value="Filter by Branch"
                                    />
                                    <select
                                        id="filter_branch"
                                        value={filterData.branch_id}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        onChange={(e) => {
                                            const branch_id = e.target.value;
                                            setFilterData("branch_id", branch_id);
                                            applyFilters({ branch_id });
                                        }}
                                    >
                                        <option value="">All Branches</option>
                                        {branches.map((branch) => (
                                            <option key={branch.id} value={branch.id}>
                                                {branch.branch_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {hasActiveFilters && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={clearFilters}
                                    >
                                        Clear Filters
                                    </Button>
                                )}
                            </div>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Branch</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.data.length ? (
                                            users.data.map((user) => (
                                                <TableRow key={user.id}>
                                                    <TableCell>{user.name}</TableCell>
                                                    <TableCell>{user.email}</TableCell>
                                                    <TableCell>
                                                        {user.role?.role_name || "-"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {user.branch?.branch_name || "-"}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={4}
                                                    className="h-24 text-center"
                                                >
                                                    No users found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-gray-600">
                                    Showing {users.from ?? 0} to {users.to ?? 0} of{" "}
                                    {users.total ?? 0} users
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => goToPage(users.current_page - 1)}
                                        disabled={users.current_page <= 1}
                                    >
                                        Previous
                                    </Button>
                                    <span className="text-sm text-gray-600">
                                        Page {users.current_page} of {users.last_page}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => goToPage(users.current_page + 1)}
                                        disabled={users.current_page >= users.last_page}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
