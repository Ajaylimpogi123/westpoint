import { Head, Link } from "@inertiajs/react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import CustomerSearchSelect from "./Partials/CustomerSearchSelect";
import ItemsTable from "./Partials/ItemsTable";
import useEditQuotation from "./Hooks/useEditQuotation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";
const labelCls = "mb-1 block text-sm font-medium text-slate-700";

export default function Edit({ quotation }) {
    const isDraft = quotation.status === "draft";
    const {
        form,
        selectedCustomer,
        addItem,
        removeItem,
        updateItem,
        total,
        selectCustomer,
        clearCustomer,
        submit,
    } = useEditQuotation(quotation);
    const { data, setData, processing, errors } = form;

    return (
        <AuthenticatedLayout>
            <Head title={`Edit ${quotation.qt_no}`} />

            <div className="mx-auto max-w-6xl px-4 py-8 relative z-10">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold text-white">
                            Edit Quotation
                        </h1>
                        <p className="text-sm text-white">
                            Q.F. No. {quotation.qt_no}
                        </p>
                    </div>
                    <Link href={route("quotations.show", quotation.id)}>
                        <Button size="sm" className="flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Back to quotation
                        </Button>
                    </Link>
                </div>

                {!isDraft && (
                    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                        This quotation is{" "}
                        <span className="font-medium capitalize">
                            {quotation.status}
                        </span>{" "}
                        and can no longer be edited. Only draft quotations are
                        editable.
                    </div>
                )}

                <form onSubmit={submit} className="space-y-6">
                    <fieldset
                        disabled={!isDraft}
                        className="space-y-6 disabled:opacity-60"
                    >
                        <div className="rounded-xl border border-slate-200 bg-white p-5">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={labelCls}>Customer</label>
                                    <CustomerSearchSelect
                                        value={selectedCustomer}
                                        onChange={selectCustomer}
                                        onClear={clearCustomer}
                                        error={errors.customer_id}
                                        disabled={!isDraft}
                                    />
                                </div>

                                <div>
                                    <label className={labelCls}>
                                        S.I.D. No.
                                    </label>
                                    <input
                                        type="text"
                                        value={data.sid_no}
                                        onChange={(e) =>
                                            setData("sid_no", e.target.value)
                                        }
                                        className={inputCls}
                                    />
                                    {errors.sid_no && (
                                        <p className="mt-1 text-xs text-red-500">
                                            {errors.sid_no}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className={labelCls}>Date</label>
                                    <input
                                        type="date"
                                        value={data.qt_date}
                                        onChange={(e) =>
                                            setData("qt_date", e.target.value)
                                        }
                                        className={inputCls}
                                    />
                                    {errors.qt_date && (
                                        <p className="mt-1 text-xs text-red-500">
                                            {errors.qt_date}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className={labelCls}>
                                        Delivery Type
                                    </label>
                                    <select
                                        value={data.delivery_type}
                                        onChange={(e) =>
                                            setData(
                                                "delivery_type",
                                                e.target.value,
                                            )
                                        }
                                        className={inputCls}
                                    >
                                        <option value="pick-up">Pick-up</option>
                                        <option value="delivery">
                                            Delivery
                                        </option>
                                    </select>
                                </div>

                                <div className="sm:col-span-2">
                                    <label className={labelCls}>Address</label>
                                    <input
                                        type="text"
                                        value={data.address}
                                        onChange={(e) =>
                                            setData("address", e.target.value)
                                        }
                                        className={inputCls}
                                    />
                                </div>

                                <div>
                                    <label className={labelCls}>
                                        Checked By
                                    </label>
                                    <input
                                        type="text"
                                        value={data.checked_by}
                                        onChange={(e) =>
                                            setData(
                                                "checked_by",
                                                e.target.value,
                                            )
                                        }
                                        className={inputCls}
                                    />
                                </div>

                                <div>
                                    <label className={labelCls}>
                                        Prepared By
                                    </label>
                                    <input
                                        type="text"
                                        value={data.prepared_by}
                                        onChange={(e) =>
                                            setData(
                                                "prepared_by",
                                                e.target.value,
                                            )
                                        }
                                        className={inputCls}
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className={labelCls}>Remarks</label>
                                    <textarea
                                        rows={2}
                                        value={data.qt_remarks}
                                        onChange={(e) =>
                                            setData(
                                                "qt_remarks",
                                                e.target.value,
                                            )
                                        }
                                        className={inputCls}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-5">
                            <h2 className="mb-3 text-sm font-semibold text-slate-700">
                                Items
                            </h2>
                            <ItemsTable
                                items={data.items}
                                errors={errors}
                                updateItem={updateItem}
                                addItem={addItem}
                                removeItem={removeItem}
                                total={total}
                            />
                            {errors.items && (
                                <p className="mt-2 text-xs text-red-500">
                                    {errors.items}
                                </p>
                            )}
                        </div>
                    </fieldset>

                    <div className="flex justify-end gap-3">
                        <Link
                            href={route("quotations.show", quotation.id)}
                            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </Link>
                        {isDraft && (
                            <button
                                type="submit"
                                disabled={processing}
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {processing ? "Saving…" : "Update Quotation"}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
