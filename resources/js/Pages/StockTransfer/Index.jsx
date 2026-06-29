import { useEffect, useState } from "react";
import { Head, usePage } from "@inertiajs/react";
import { toast } from "sonner";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";

// Hooks
import { useStockTransferForm } from "./Hooks/useStockTransferForm";
import { useStockTransferList } from "./Hooks/useStockTransferList";
import { useApproval } from "./Hooks/useApproval";

// Partials
import TransferWizard from "./Partials/TransferWizard";
import TransfersTable from "./Partials/TransfersTable";
import ApprovalCard from "./Partials/ApprovalCard";
import TransferDetailModal from "./Partials/TransferDetailModal";

export default function Index({
    transfers,
    isAdmin,
    products = [],
    branches = [],
    userBranch,
    userBranchName,
}) {
    const {
        props: { flash },
    } = usePage();

    // Flash toasts — useEffect prevents firing on every re-render
    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    const [detailTransfer, setDetailTransfer] = useState(null);

    const wizardForm = useStockTransferForm({ userBranch });
    const listState = useStockTransferList();
    const approval = useApproval();

    const pendingTransfers =
        transfers.data?.filter((t) => t.status === "pending") ?? [];

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-800">
                        Stock Transfers
                    </h2>
                    {isAdmin && pendingTransfers.length > 0 && (
                        <span
                            className="inline-flex items-center gap-1.5 text-xs
                            px-2.5 py-1 rounded-full bg-yellow-100
                            text-yellow-700 font-medium"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                            {pendingTransfers.length} pending approval
                        </span>
                    )}
                </div>
            }
        >
            <Head title="Stock Transfers" />

            <div className="relative z-10 py-8">
                <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Stock Transfer
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Stock Transfer Request, Stock Transfer Approval ,
                            and review Stock Transfer activity.
                        </p>
                    </div>

                    <Tabs
                        defaultValue={isAdmin ? "pending" : "new-request"}
                        className="space-y-6"
                    >
                        {/* ── Tab triggers ──────────────────────────── */}
                        <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-white/10 p-1 sm:grid-cols-2">
                            {isAdmin ? (
                                <>
                                    <TabsTrigger
                                        value="pending"
                                        className="gap-2"
                                    >
                                        Pending
                                        {pendingTransfers.length > 0 && (
                                            <span
                                                className="inline-flex items-center justify-center
                                            w-5 h-5 text-[10px] font-bold rounded-full
                                            bg-yellow-400 text-yellow-900"
                                            >
                                                {pendingTransfers.length}
                                            </span>
                                        )}
                                    </TabsTrigger>
                                    <TabsTrigger value="all">
                                        All Requests
                                    </TabsTrigger>
                                </>
                            ) : (
                                <>
                                    <TabsTrigger value="new-request">
                                        + New Request
                                    </TabsTrigger>
                                    <TabsTrigger value="my-requests">
                                        My Requests
                                    </TabsTrigger>
                                </>
                            )}
                        </TabsList>

                        {/* ════════════════════════════════════════════
                        STAFF TABS
                    ════════════════════════════════════════════ */}

                        {/* New Request — wizard */}
                        <TabsContent value="new-request">
                            <div className="bg-white rounded-xl border border-gray-200 p-6">
                                <div className="mb-5">
                                    <h3 className="text-sm font-semibold text-gray-800">
                                        New stock transfer request
                                    </h3>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        Select medicine → choose lot → enter
                                        destination. Your request will be sent
                                        to admin for approval.
                                    </p>
                                </div>

                                <TransferWizard
                                    step={wizardForm.step}
                                    goNext={wizardForm.goNext}
                                    goBack={wizardForm.goBack}
                                    data={wizardForm.data}
                                    setData={wizardForm.setData}
                                    errors={wizardForm.errors}
                                    processing={wizardForm.processing}
                                    selectedItems={wizardForm.selectedItems}
                                    addItem={wizardForm.addItem}
                                    removeItem={wizardForm.removeItem}
                                    submit={wizardForm.submit}
                                    products={products}
                                    branches={branches}
                                    userBranchName={userBranchName}
                                />
                            </div>
                        </TabsContent>

                        {/* My Requests — list */}
                        <TabsContent value="my-requests">
                            <div className="space-y-4">
                                <SearchBar listState={listState} />
                                <TransfersTable
                                    transfers={transfers}
                                    isAdmin={false}
                                    onCancel={approval.cancel}
                                    onView={setDetailTransfer}
                                />
                            </div>
                        </TabsContent>

                        {/* ════════════════════════════════════════════
                        ADMIN TABS
                    ════════════════════════════════════════════ */}

                        {/* Pending — approval cards */}
                        <TabsContent value="pending">
                            <div className="space-y-4">
                                {pendingTransfers.length === 0 ? (
                                    <EmptyState message="No pending transfer requests." />
                                ) : (
                                    pendingTransfers.map((transfer) => (
                                        <ApprovalCard
                                            key={transfer.id}
                                            transfer={transfer}
                                            approval={approval}
                                            onView={setDetailTransfer}
                                        />
                                    ))
                                )}
                            </div>
                        </TabsContent>

                        {/* All Requests — full list */}
                        <TabsContent value="all">
                            <div className="space-y-4">
                                <SearchBar
                                    listState={listState}
                                    showStatusFilter
                                />
                                <TransfersTable
                                    transfers={transfers}
                                    isAdmin={true}
                                    onCancel={approval.cancel}
                                    onView={setDetailTransfer}
                                />
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Detail modal */}
            {detailTransfer && (
                <TransferDetailModal
                    transfer={detailTransfer}
                    onClose={() => setDetailTransfer(null)}
                />
            )}
        </AuthenticatedLayout>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Search + status filter bar
// ─────────────────────────────────────────────────────────────────────
function SearchBar({ listState, showStatusFilter = false }) {
    const {
        search,
        setSearch,
        statusFilter,
        setStatusFilter,
        applyFilters,
        clearFilters,
        handleSearchKey,
    } = listState;

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKey}
                placeholder="Search by ref no, medicine, branch…"
                className="flex-1 min-w-[200px] text-sm border border-gray-300
                    rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500
                    focus:outline-none"
            />

            {showStatusFilter && (
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2
                        focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                    <option value="all">All status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            )}

            <button
                type="button"
                onClick={applyFilters}
                className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white
                    hover:bg-blue-700 transition"
            >
                Search
            </button>

            {(search || statusFilter !== "all") && (
                <button
                    type="button"
                    onClick={clearFilters}
                    className="text-sm px-3 py-2 rounded-lg border border-gray-300
                        text-gray-500 hover:bg-gray-50 transition"
                >
                    Clear
                </button>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────
function EmptyState({ message }) {
    return (
        <div
            className="flex flex-col items-center justify-center py-20
            text-gray-400 gap-3"
        >
            <svg
                className="w-12 h-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
            </svg>
            <p className="text-sm">{message}</p>
        </div>
    );
}
